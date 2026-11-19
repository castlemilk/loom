export async function measure(browser, run, origin) {
  const report = {}
  report.startup = []
  for (let i = 0; i < 7; i++) report.startup.push(await run('startup'))
  report.clearOnly = []
  for (let i = 0; i < 3; i++) report.clearOnly.push(await run('clearOnly'))
  report.evaluation = await run('evaluation')
  report.settlement = await run('settlement')
  report.throughput = []
  for (const n of [5000, 25000]) {
    const metrics = await run('throughput', [n])
    report.throughput.push(metrics)
  }
  report.consoleThroughput = []
  for (const n of [5000, 25000]) report.consoleThroughput.push(await run('throughput', [n, 72, true]))
  const inputCtx = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
  })
  try {
    const p = await inputCtx.newPage()
    await p.goto(origin + '/tests/blank.html')
    await p.evaluate(async () => (await import('/tests/browser-scenarios.mjs')).inputSetup())
    for (let i = 0; i < 24; i++) await p.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight')
    report.input = await p.evaluate(() => globalThis.inputResults())
  } finally {
    await inputCtx.close()
  }
  report.idle = await run('lifecycle')
  report.codecs = await run('codecs')
  const ctx = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
  })
  try {
    const p = await ctx.newPage(),
      cdp = await ctx.newCDPSession(p)
    await p.goto(origin + '/tests/blank.html')
    await p.evaluate(async () => (await import('/tests/browser-scenarios.mjs')).trackGpu())
    async function usage() {
      await cdp.send('HeapProfiler.collectGarbage')
      const h = await cdp.send('Runtime.getHeapUsage')
      return h.usedSize + h.backingStorageSize
    }
    const before = await usage()
    await p.evaluate(async () => (await import('/tests/browser-scenarios.mjs')).memoryCase())
    await p.evaluate(() => globalThis.memoryGraph.pause())
    const jsAndBacking = (await usage()) - before
    const gpu = await p.evaluate(() => globalThis.loomGpuBytes())
    const total = jsAndBacking + gpu.buffers + gpu.textures + gpu.framebuffer
    report.memory = { jsAndBacking, ...gpu, total }
  } finally {
    await ctx.close()
  }
  report.failures = budgetFailures(report)
  return report
}

export function budgetFailures(report) {
  const failures = []
  const check = (ok, message) => {
    if (!ok) failures.push(message)
  }
  check(report.startup.length === 7, 'Seven fresh-context trials required')
  check(
    report.startup.every((r) => r.submit <= 10),
    '1k first draw submission exceeds 10 ms',
  )
  check(
    report.startup.every((r) => r.present <= 10),
    '1k first canvas presentation exceeds 10 ms',
  )
  check(
    report.startup.every((r) => !/swiftshader|llvmpipe|software|unknown/i.test(r.gpu)),
    'Hardware GPU required',
  )
  check(report.evaluation.evaluationMs < 2, 'Core evaluation exceeds 2 ms')
  for (const [i, n, fps] of [
    [0, 5000, 60],
    [1, 25000, 30],
  ]) {
    for (const [name, r] of [
      ['default', report.throughput[i]],
      ['knowledge console', report.consoleThroughput[i]],
    ]) {
      check(
        r.nodes === n && r.completed === 72 && r.fps >= fps,
        name + ' at ' + n + ' nodes below ' + fps + ' completed GPU frames/s',
      )
    }
  }
  check(
    report.input.samples > 0 && report.input.ticks > 0 && report.input.maxMs < 16,
    'Input latency exceeds 16 ms during settling',
  )
  check(
    report.idle.idleFrames === 0 && report.idle.idleTicks === 0 && report.idle.idleCallbacks === 0,
    'Settled graph performed idle work',
  )
  check(
    Number.isFinite(report.memory.total) && report.memory.total < 50000000,
    '25k tracked CPU/GPU footprint exceeds 50 MB',
  )
  return failures
}
