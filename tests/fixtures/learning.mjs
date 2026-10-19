// Synthetic teaching examples for deterministic curriculum regression tests.
export const lessonPapers=[
 {id:'orientation',title:'Introduction to Graph Theory',abstract:'This introductory overview explains the vocabulary and purpose of graph theory for beginners. No prior knowledge is required.'},
 {id:'foundations',title:'Fundamental Concepts of Graph Theory',abstract:'This chapter explains the basic concepts of graph theory, including vertices, edges, paths, connectivity and algorithms. It presents elementary examples and exercises.'},
 {id:'methods',title:'Methods for Studying Graph Theory',abstract:'This tutorial describes methods for studying graph theory. It explains how proofs and graph algorithms are constructed and how to interpret their results.'},
 {id:'applications',title:'Graph Theory Applications in Transport',abstract:'This case study applies graph theory to transport networks, linking graph algorithms to practical routing examples and interpreting their results.'},
 {id:'advanced',title:'Advanced Graph Theory for Transport',abstract:'This article examines advanced graph theory in transport and unresolved research challenges. It compares limitations of current approaches and discusses open problems in network analysis.'}
].map((paper,i)=>({...paper,authors:'Example, Alice',year:'2024',doi:'10.0000/lesson-'+i,topic:{id:'graph-theory',label:'Graph Theory'},keywords:'graph theory',references:[],status:'Unread',notes:'',type:'article',relevanceScore:5-i}));
export function asOpenAlex(paper){
 const index={};paper.abstract.split(/\s+/).forEach((word,i)=>(index[word]??=[]).push(i));
 return {id:'https://openalex.org/'+paper.id,title:paper.title,doi:paper.doi,language:'en',abstract_inverted_index:index,primary_topic:{id:'https://openalex.org/'+paper.topic.id,display_name:paper.topic.label,subfield:{display_name:paper.topic.label}},authorships:[],publication_year:2024};
}

// A larger topic spans several complementary readings per learning stage.
const socialBase=lessonPapers.map(paper=>({...paper,id:'social-'+paper.id,title:paper.title.replace(/Graph Theory/g,'Social Recognition'),abstract:paper.abstract.replace(/graph theory/g,'social recognition'),keywords:'social recognition',topic:{id:'social-recognition',label:'Social Recognition'},doi:paper.doi+'-social'}));
const perspectives=[
 ['olfactory cues','odor discrimination and individual scent profiles'],
 ['facial perception','visual identity and perceptual invariance'],
 ['developmental trajectories','juvenile maturation and lifespan changes'],
 ['neuroendocrine modulation','oxytocin signaling and hormonal regulation']
];
export const expandedLessonPapers=[...socialBase,...socialBase.flatMap((paper,stage)=>perspectives.map(([label,detail],i)=>({...paper,id:paper.id+'-'+i,doi:paper.doi+'-'+i,title:paper.title+': '+label,abstract:paper.abstract+' This reading examines '+detail+'.',keywords:paper.keywords+', '+label})))];
