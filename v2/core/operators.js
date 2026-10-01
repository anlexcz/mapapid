import {keyPart} from './identity.js';

export function buildOperatorAliasMap(config={}){
  const map=new Map();
  for(const [key,value] of Object.entries(config||{})){
    const canonical=value?.source_name||value?.name||key;
    const aliases=[key,value?.source_name,value?.name,value?.short_name,...(value?.aliases||[])].filter(Boolean);
    for(const alias of aliases)map.set(keyPart(alias),canonical);
  }
  return map;
}

export function canonicalOperator(name,aliasMap){
  if(!name)return '';
  return aliasMap?.get(keyPart(name))||String(name);
}
