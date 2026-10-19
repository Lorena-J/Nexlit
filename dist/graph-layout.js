// Resolve overlap in the projected view, leaving the underlying topic layout intact.
export function separateNodes(points,{gap=10,passes=8}={}){
 const nodes=points.map(point=>({...point}));
 for(let pass=0;pass<passes;pass++){
  let largest=0;
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j];let dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy);
   const minimum=a.radius+b.radius+gap;
   if(distance>=minimum)continue;
   if(distance<.001){const angle=(i*31+j*17)*2.399963;dx=Math.cos(angle);dy=Math.sin(angle);distance=1}
   const overlap=minimum-Math.hypot(b.x-a.x,b.y-a.y),shift=overlap*.5;
   a.x-=dx/distance*shift;a.y-=dy/distance*shift;b.x+=dx/distance*shift;b.y+=dy/distance*shift;
   largest=Math.max(largest,overlap);
  }
  if(largest<.2)break;
 }
 // Dense projections may still overlap after relaxation. Place each remaining
 // collision at the nearest sampled free position, with a guaranteed fallback.
 const placed=[],buckets=new Map(),cell=Math.max(1,...nodes.map(node=>node.radius*2+gap));
 const bucketKey=(x,y)=>x+','+y;
 for(const node of nodes){
  const origin={x:node.x,y:node.y};
  const clear=()=>{
   const x=Math.floor(node.x/cell),y=Math.floor(node.y/cell);
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
    for(const other of buckets.get(bucketKey(x+dx,y+dy))||[]){
     const minimum=node.radius+other.radius+gap-.01;
     if((node.x-other.x)**2+(node.y-other.y)**2<minimum*minimum)return false;
    }
   }
   return true;
  };
  for(let step=1;!clear();step++){
   if(step>2000){node.x=Math.max(...placed.map(other=>other.x+other.radius))+node.radius+gap;break}
   const angle=step*2.399963,distance=8*Math.sqrt(step);
   node.x=origin.x+Math.cos(angle)*distance;node.y=origin.y+Math.sin(angle)*distance;
  }
  placed.push(node);
  const key=bucketKey(Math.floor(node.x/cell),Math.floor(node.y/cell));
  if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(node);
 }
 return nodes;
}

export function visibleLabels(points,{priority=[]}={}){
 const ordered=[...points].sort((a,b)=>{
  const ai=priority.indexOf(a.id),bi=priority.indexOf(b.id);
  return (ai<0?Infinity:ai)-(bi<0?Infinity:bi);
 });
 const visible=new Set(),occupied=[];
 for(const point of ordered){
  const {id,x,y,width,height}=point,box={left:x-width/2,right:x+width/2,top:y,bottom:y+height};
  const collides=occupied.some(other=>box.left<other.right+6&&box.right>other.left-6&&box.top<other.bottom+4&&box.bottom>other.top-4);
  if(priority.includes(id)||!collides){visible.add(id);occupied.push(box)}
 }
 return visible;
}
