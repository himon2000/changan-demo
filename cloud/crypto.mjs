import {sha256} from '@noble/hashes/sha2.js';
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export function randomBytes(n){const bytes=crypto.getRandomValues(new Uint8Array(n));return {toString:()=>hex(bytes)}}
export function createHash(){let input='';return {update(value){input+=value;return this},digest(){return hex(sha256(new TextEncoder().encode(input)))}}}
