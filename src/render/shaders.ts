export const quad = `
vec2 corner() { return vec2(gl_VertexID & 1, (gl_VertexID >> 1) & 1); }
`
// Both programs use the default uniform-block binding (zero). No shader queries
// or GPU round trips are required to submit the first frame.
const scene = `
layout(std140) uniform Scene {
  vec4 screenData, centerData, basis, stateData, bgData, bezelData, accentData, dimData, wireData, markData, gridData, laneData;
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
export const nodeFragment =
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
  float aa = max(fwidth(d)*0.65, 0.002);
  if (d > aa) discard;
  vec3 ring = mix(pigment.rgb, accent, details.y);
  float ringWidth = min(0.48, (markData.x+details.y)/details.w);
  vec3 fill = mix(bezel, pigment.rgb, markData.y);
  if (pigment.a > 0.5 && pigment.a < 0.9) fill = mix(bezel, fill, 1.0-smoothstep(0.55-aa,0.55+aa,length(local)));
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
export const wireVertex =
  projection +
  `
layout(location=0) in uvec2 ends;
layout(location=1) in vec4 wireColor;
layout(location=2) in float wireWidth;
out vec4 pigment;
void main() {
  vec4 na=nodeAt(int(ends.x)), nb=nodeAt(int(ends.y));
  vec4 a = projectNode(na), b = projectNode(nb);
  vec2 delta = b.xy-a.xy;
  vec2 bend = vec2(-delta.y,delta.x) * (((gl_InstanceID & 1)==0 ? 1.0 : -1.0)*0.17);
  vec2 c = a.xy+delta*0.29+bend, d = a.xy+delta*0.71+bend;
  if (wireData.x==1.0) {
    vec2 mid = (a.xy+b.xy)*0.5;
    c=laneData.w>0.5 ? vec2(a.x,mid.y) : vec2(mid.x,a.y);
    d=laneData.w>0.5 ? vec2(b.x,mid.y) : vec2(mid.x,b.y);
  } else if (wireData.x==2.0) { c=a.xy+delta/3.0; d=b.xy-delta/3.0; }
  if (ends.x==ends.y) { c = a.xy+vec2(-2,-3)*a.z; d = a.xy+vec2(2,-3)*a.z; }
  float t = float(gl_VertexID >> 1) / float(segments), s = 1.0-t;
  vec2 curve = s*s*s*a.xy + 3.0*s*s*t*c + 3.0*s*t*t*d + t*t*t*b.xy;
  vec2 tangent = s*s*(c-a.xy) + 2.0*s*t*(d-c) + t*t*(b.xy-d);
  vec2 normal = vec2(-tangent.y,tangent.x) / max(0.001,length(tangent));
  bool hot = int(ends.x)==selected || int(ends.y)==selected || int(ends.x)==hovered || int(ends.y)==hovered;
  bool styled = wireData.w > 0.5;
  float width = styled ? wireWidth : wireData.y;
  float alpha = hot ? 0.9 : (selected >= 0 ? 0.045 : (styled ? wireColor.a : density));
  float depth=mix(a.w,b.w,t);
  if (centerData.w>0.5) {
    vec4 p=projectNode(mix(na,nb,t));
    curve+=p.xy-mix(a.xy,b.xy,t);
    depth=p.w+0.003;
    float far=smoothstep(-0.38,0.45,depth);
    width*=mix(1.35,0.65,far);
    if (!hot) alpha*=mix(1.38,0.33,far);
  }
  pigment = vec4(hot ? accent : (styled ? wireColor.rgb : dim), alpha);
  float side = (gl_VertexID & 1)==0 ? -1.0 : 1.0;
  gl_Position = clip(curve + normal*side*(hot ? wireData.z : width)*0.5, depth);
}
`
export const wireFragment = `in vec4 pigment; out vec4 color; void main(){color=pigment;}`
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
  color=vec4(mix(bg,gridData.rgb,max(dots,guide)),1);
}`
