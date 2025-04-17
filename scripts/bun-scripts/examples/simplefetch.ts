import { fetch } from 'bun';

const res = await fetch('http://localhost:3123');
const text = await res.text();

console.log(text);
console.log(res.status);