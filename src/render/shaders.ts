export const quad = `
vec2 corner() { return vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1); }
`
// Both programs use the default uniform-block binding (zero). No shader queries
// or GPU round trips are required to submit the first frame.
const scene = `
layout(std140) uniform Scene {
  vec4 screenData, centerData, basis, stateData, bgData, bezelData, accentData, dimData, wireData, markData, gridData, laneData, effectData, drawingData;
};
#define viewport screenData.xy
#define origin centerData.xyz
#define selected int(stateData.x)
#define hovered int(stateData.y)
#define segments int(stateData.z)
#define density stateData.w
#define bg bgData.rgb
#define bezel bezelData.rgb
#define accent accentData.rgb
#define dim dimData.rgb
`
const projection =
  scene +
  `
uniform highp sampler2D positions;
vec4 nodeAt(int i) { return texelFetch(positions, ivec2(i & 255, i >> 8), 0); }
vec4 projectNode(vec4 node) {
  vec3 v = node.xyz - origin;
  v.z *= centerData.w;
  vec2 xz = vec2(basis.x*v.x + basis.y*v.z, -basis.y*v.x + basis.x*v.z);
  float y = basis.z*v.y - basis.w*xz.y, depth = basis.w*v.y + basis.z*xz.y;
  float scale = screenData.z / max(0.25, 1.0 - depth*screenData.w);
  return vec4(viewport*0.5 + vec2(xz.x,y)*scale, max(1.3,node.w*scale), clamp(-depth*screenData.w,-0.99,0.99));
}
vec4 clip(vec2 xy, float z) { return vec4((xy/viewport*2.0-1.0)*vec2(1,-1), z, 1); }
`
export const nodeVertex =
  projection +
  quad +
  `
layout(location=0) in vec4 style;
layout(location=1) in float artIndex;
layout(location=2) in float neighbor;
out vec2 local;
flat out vec4 pigment;
flat out vec4 details;
flat out float eyeDepth;
void main() {
  vec4 p = projectNode(nodeAt(gl_InstanceID));
  float hot = float(gl_InstanceID == selected || gl_InstanceID == hovered);
  float r = p.z + hot*1.5;
  local = (corner()*2.0-1.0)*(1.0+1.0/r);
  pigment = style;
  details = vec4(artIndex, hot, float(selected >= 0 && neighbor < 0.5 && hot < 0.5), r);
  eyeDepth = p.w;
  gl_Position = clip(p.xy+local*r, p.w);
}
`
const nodeDistance =
  scene +
  `
in vec2 local;
flat in vec4 pigment, details;
flat in float eyeDepth;
uniform sampler2D art0, art1;
out vec4 color;
void main() {
  vec2 q = abs(local)-vec2(0.69);
  float d = pigment.a > 0.5 ? length(local)-1.0 : length(max(q,0.0))+min(max(q.x,q.y),0.0)-0.31;
  if (pigment.a > 0.1 && pigment.a < 0.5) d = max(abs(local.x),abs(local.y))-1.0;
`
const nodeSurface = `
  float aa = max(fwidth(d)*0.65, 0.002);
  if (d > aa) discard;
  vec3 ring = mix(pigment.rgb, accent, details.y);
  float ringWidth = min(0.48, (markData.x+details.y)/details.w);
  vec3 fill = mix(bezel, pigment.rgb, markData.y);
  if (pigment.a > 0.5 && pigment.a < 0.9) fill = mix(bezel, fill, 1.0-smoothstep(0.55-aa,0.55+aa,length(local)));
`
const nodeComposite = `
  if (markData.w > 0.5 && details.x > 0.5 && d < -ringWidth) {
    int slot = int(details.x)-1;
    vec2 cell = vec2(slot & 31, (slot >> 5) & 31);
    vec2 uv = (cell*64.0+clamp((local*0.5+0.5)*64.0,0.5,63.5))/2048.0;
    vec4 art = slot < 1024 ? texture(art0,uv) : texture(art1,uv);
    fill = mix(fill,art.rgb,art.a);
  }
  vec3 rgb = mix(fill, ring, smoothstep(-ringWidth-aa,-ringWidth+aa,d));
  if (centerData.w > 0.5) {
    vec3 normal = normalize(vec3(local, sqrt(max(0.03,1.0-dot(local,local)))));
    float light = max(0.0,dot(normal,vec3(-0.42,-0.58,0.69)));
    rgb = rgb*(0.73+0.39*light)+0.18*pow(light,8.0);
    rgb = mix(rgb,bg,0.59*smoothstep(-0.36,0.49,eyeDepth)*(1.0-details.y));
  }
  color = vec4(mix(rgb,bg,details.z*0.74), 1.0-smoothstep(-aa,aa,d));
}
`
export const nodeFragment = nodeDistance + nodeSurface + nodeComposite
export const drawingNodeFragment = nodeDistance + `
  if (drawingData.x>0.0 && dot(local,local)>0.2) {
    float angle=atan(local.y,local.x);
    d+=drawingData.x*min(0.15,2.4/details.w)*(0.5+0.3*sin(angle*3.0)+0.2*cos(angle*5.0));
  }
` + nodeSurface + `
  if(drawingData.y>0.5){
    vec2 lines=vec2(local.x+local.y,local.x-local.y)*details.w*0.7071;
    vec2 dist=abs(fract(lines/drawingData.z+0.5)-0.5)*drawingData.z;
    float stripe=drawingData.y>1.5 ? min(dist.x,dist.y) : dist.x;
    fill=mix(bezel,fill,0.08+0.92*(1.0-smoothstep(0.2,1.2,stripe)));
  }
` + nodeComposite
export const wireInputs =
  projection +
  `
layout(location=0) in uvec2 ends;
layout(location=1) in vec4 wireColor;
layout(location=2) in float wireWidth;
out vec4 pigment;
out vec4 dash;`
export const wireEndpoints = `
  vec4 na=nodeAt(int(ends.x)), nb=nodeAt(int(ends.y));
  vec4 a = projectNode(na), b = projectNode(nb);
  vec2 delta = b.xy-a.xy;
`
export const wireControls = `
  vec2 bend = vec2(-delta.y,delta.x) * (((gl_InstanceID & 1)==0 ? 1.0 : -1.0)*0.17);
  vec2 c = a.xy+delta*0.29+bend, d = a.xy+delta*0.71+bend;
  if (wireData.x==1.0) {
    vec2 mid = (a.xy+b.xy)*0.5;
    c=laneData.w>0.5 ? vec2(a.x,mid.y) : vec2(mid.x,a.y);
    d=laneData.w>0.5 ? vec2(b.x,mid.y) : vec2(mid.x,b.y);
  } else if (wireData.x==2.0) { c=a.xy+delta/3.0; d=b.xy-delta/3.0; }
`
const defaultLoop = `
  if (ends.x==ends.y) { c = a.xy+vec2(-2,-3)*a.z; d = a.xy+vec2(2,-3)*a.z; }
`
export const wireCurve = `
  float t = float(gl_VertexID >> 1) / float(segments), s = 1.0-t;
  vec2 curve = s*s*s*a.xy + 3.0*s*s*t*c + 3.0*s*t*t*d + t*t*t*b.xy;
  vec2 tangent = s*s*(c-a.xy) + 2.0*s*t*(d-c) + t*t*(b.xy-d);
  vec2 normal = vec2(-tangent.y,tangent.x) / max(0.001,length(tangent));
  bool hot = int(ends.x)==selected || int(ends.y)==selected || int(ends.x)==hovered || int(ends.y)==hovered;
  bool styled = wireData.w > 0.5;
  float stroke = styled ? wireWidth : wireData.y;
  float pattern = floor(stroke/128.0);
  float width = mod(stroke,128.0);
  float alpha = hot ? 0.9 : (selected >= 0 ? 0.045 : (styled ? wireColor.a : density));
  float depth=mix(a.w,b.w,t);
  if (centerData.w>0.5) {
    vec4 p=projectNode(mix(na,nb,t));
`
// The enhanced path uses a screen-space cubic for both distance and tangents.
// Both passes keep the same interpolated scene depth and fog.
const wireStroke = `
    depth=p.w+0.003;
    float far=smoothstep(-0.38,0.45,depth);
    width*=mix(1.35,0.65,far);
    if (!hot) alpha*=mix(1.38,0.33,far);
  }
  pigment = vec4(hot ? accent : (styled ? wireColor.rgb : dim), alpha);
  float side = (gl_VertexID & 1)==0 ? -1.0 : 1.0;
  if (hot) width=max(wireData.z,width);
`
export const wireVertex = wireInputs + 'void main(){' + wireEndpoints + wireControls + defaultLoop + wireCurve + `curve+=p.xy-mix(a.xy,b.xy,t);` + wireStroke + `
  float along=0.0;
  if (pattern>0.5) along=t*0.5*(length(delta)+length(c-a.xy)+length(d-c)+length(b.xy-d));
  dash=vec4(along,side*width*0.5,width,pattern);
  gl_Position = clip(curve + normal*side*width*0.5, depth);
}
`
export const wireFragmentInputs = `
in vec4 pigment;
in vec4 dash;
out vec4 color;
float strokeMask(){
  if(dash.w>0.5){
    float unit=max(1.5,dash.z);
    float period=(dash.w>1.5 ? 2.6 : 5.0)*unit;
    float phase=abs(mod(dash.x+0.5*period,period)-0.5*period);
    float edge=dash.w>1.5 ? length(vec2(phase,dash.y))-0.5*dash.z : phase-1.5*unit;
    return clamp(0.5-edge,0.0,1.0);
  }
  return 1.0;
}`
export const wireFragment = wireFragmentInputs + `
void main(){
  float coverage=strokeMask();
  if(coverage<=0.0) discard;
  color=vec4(pigment.rgb,pigment.a*coverage);
}`
// The optional wire entry point shares projection, stroke styles and depth with the default pass.
export const effectsWireVertex = wireInputs + `
layout(location=3) in vec2 laneSlot;
out vec2 arrow;
float speedAt(float u,vec2 v0,vec2 v1,vec2 v2){
  return 3.0*length(mix(mix(v0,v1,u),mix(v1,v2,u),u));
}
float arcLength(float end,vec2 v0,vec2 v1,vec2 v2){
  // Three-point Gauss quadrature measures distance along the projected cubic.
  return end*(0.2777778*(speedAt(0.1127017*end,v0,v1,v2)+speedAt(0.8872983*end,v0,v1,v2))
    +0.4444444*speedAt(0.5*end,v0,v1,v2));
}
void main(){` + wireEndpoints + wireControls + `
  if(ends.x==ends.y){
    float angle=laneSlot.x*2.399963;
    mat2 turn=mat2(cos(angle),sin(angle),-sin(angle),cos(angle));
    float radius=max(7.0,a.z)+sqrt(laneSlot.x)*effectData.x*0.45;
    c=a.xy+turn*vec2(-2.0,-3.0)*radius;
    d=a.xy+turn*vec2(2.0,-3.0)*radius;
  }else if(laneSlot.y>1.0){
    if(wireData.x==0.0){ c=a.xy+delta*0.29; d=a.xy+delta*0.71; }
    vec2 offset=vec2(-delta.y,delta.x)/max(length(delta),0.001)*laneSlot.x*effectData.x*1.3333333;
    c+=offset;
    d+=offset;
  }
  if(drawingData.x>0.0){
    vec2 handle=d-c;
    vec2 across=vec2(-handle.y,handle.x)/max(length(handle),0.01);
    float seed=float(ends.x)*2.39996+float(ends.y)*1.61803;
    vec2 wobble=across*min(12.0,(length(delta)+a.z)*0.14)*drawingData.x;
    if((gl_InstanceID & 1)==1) wobble=-wobble;
    c+=wobble*(0.65+0.35*sin(seed));
    d-=wobble*(0.65+0.35*cos(seed));
  }
` + wireCurve + wireStroke + `
  bool marked=effectData.y>0.5 && (effectData.z>0.5 || int(ends.x)==selected || int(ends.y)==selected);
  float along=0.0, tip=0.0;
  if(pattern>0.5 || marked){
    if(wireData.x==2.0 && drawingData.x==0.0 && ends.x!=ends.y && (laneSlot.y<=1.0 || effectData.x==0.0)){
      along=t*length(delta);
      tip=length(delta);
    }else{
      along=arcLength(t,c-a.xy,d-c,b.xy-d);
      if(marked) tip=arcLength(1.0,c-a.xy,d-c,b.xy-d);
    }
  }
  tip-=b.z+3.0;
  float head=min(clamp(6.0+width*1.4,7.0,18.0),tip-a.z-2.0);
  if(!marked || head<4.0 || width<=0.0) head=0.0;
  float span=max(0.5*width,head*0.46)+0.8;
  dash=vec4(along,side*span,width,pattern);
  arrow=vec2(tip-along,head);
  gl_Position=clip(curve+normal*side*span,depth);
}`
export const effectsWireFragment = scene + wireFragmentInputs + `
in vec2 arrow;
void main(){
  if(dash.z<=0.0 || pigment.a<=0.0) discard;
  float lateral=abs(dash.y);
  float shaft=clamp(0.5+0.5*dash.z-lateral,0.0,1.0);
  float coverage=shaft*strokeMask(), pulse=0.0;
  if(arrow.y>0.0){
    float edge=max(max(-arrow.x,arrow.x-arrow.y),lateral-arrow.x*0.46);
    coverage=max(coverage,clamp(0.5-edge,0.0,1.0));
    if(effectData.y>1.5 && effectData.w>=0.0){
      float behind=mod(effectData.w-dash.x,72.0);
      float dotDistance=length(vec2(min(behind,72.0-behind),dash.y));
      pulse=max(shaft*(1.0-smoothstep(1.0,14.0,behind))*0.75,
                clamp(0.5+min(3.5,1.5+0.4*dash.z)-dotDistance,0.0,1.0));
    }
  }
  if(max(coverage,pulse)<=0.0) discard;
  color=vec4(mix(pigment.rgb,accent,pulse*0.7),
             max(coverage*pigment.a,pulse*min(1.0,pigment.a*2.5+0.15)));
}`
export const labelVertex =
  quad +
  `
layout(location=0) in vec4 rect;
layout(location=1) in vec4 glyph;
uniform vec2 viewport;
out vec2 uv;
void main() {
  vec2 p = corner();
  uv = (glyph.xy+p*glyph.zw)/1024.0;
  gl_Position = vec4(((rect.xy+p*rect.zw)/viewport*2.0-1.0)*vec2(1,-1),0,1);
}
`
export const labelFragment = `
uniform sampler2D atlas;
uniform vec3 ink, bg;
uniform float plateAlpha;
in vec2 uv;
out vec4 color;
void main() {
  float a = texture(atlas,uv).a;
  float halo = max(max(textureOffset(atlas,uv,ivec2(1,0)).a,textureOffset(atlas,uv,ivec2(-1,0)).a),
                   max(textureOffset(atlas,uv,ivec2(0,1)).a,textureOffset(atlas,uv,ivec2(0,-1)).a));
  color = vec4(mix(bg,ink,a), max(a,halo*plateAlpha));
}
`

export const gridVertex = `
out vec2 uv;
void main() {
  uv = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position=vec4(uv*2.0-1.0,0,1);
}`
export const gridFragment =
  scene +
  `
in vec2 uv;
out vec4 color;
void main() {
  vec2 world = (vec2(uv.x,1.0-uv.y)-0.5)*viewport/screenData.z+origin.xy;
  float spacing=markData.z*max(1.0,exp2(ceil(log2(13.0/(markData.z*screenData.z)))));
  vec2 delta=(fract(world/spacing+0.5)-0.5)*spacing*screenData.z;
  float dots=(1.0-smoothstep(0.35,1.25,length(delta)))*gridData.a;
  vec2 axis=laneData.w>0.5 ? world.yx : world.xy;
  float index=axis.x/laneData.y+(laneData.x-1.0)*0.5;
  float lane=1.0-smoothstep(0.25,1.1,abs(index-floor(index+0.5))*laneData.y*screenData.z);
  float dash=1.0-smoothstep(0.35,0.52,fract(axis.y*screenData.z/9.0));
  float guide=lane*dash*laneData.z*float(index>=-0.5 && index<laneData.x-0.5);
  color=vec4(gridData.rgb,max(dots,guide));
}`
