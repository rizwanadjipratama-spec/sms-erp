const fs = require("fs");
const path = require("path");

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = dir + "/" + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith(".tsx")) results.push(file);
        }
    });
    return results;
}

const files = walk("src/app/dashboard");

const replacements = [
    [/bg-slate-900 border border-slate-800/g, "bg-white border border-gray-200 shadow-sm"],
    [/bg-slate-900\/60 border border-slate-800/g, "bg-white/60 border border-gray-200 shadow-sm"],
    [/bg-slate-900/g, "bg-white border-gray-200 shadow-sm"], 
    [/bg-slate-950\/60 border border-slate-800/g, "bg-gray-50 border border-gray-200"],
    [/bg-slate-950\/50 border border-slate-800/g, "bg-gray-50 border border-gray-200"],
    [/border-slate-800/g, "border-gray-200"],
    [/border-slate-700/g, "border-gray-300"],
    [/bg-slate-800/g, "bg-gray-100"],
    [/text-white/g, "text-gray-900"],
    [/text-slate-400/g, "text-gray-500"],
    [/text-slate-500/g, "text-gray-500"],
    [/text-slate-300/g, "text-gray-600"],
    [/text-slate-200/g, "text-gray-700"],
    [/placeholder-slate-500/g, "placeholder-gray-400"],
    [/border-t-transparent/g, "border-t-transparent"] 
];

let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, "utf8");
    let initial = content;
    
    // Quick fixes for double shadow or border
    content = content.replace(/border-gray-200 shadow-sm border border-gray-200 shadow-sm/g, "border border-gray-200 shadow-sm");
    
    replacements.forEach(([regex, replaceStr]) => {
        content = content.replace(regex, replaceStr);
    });
    
    // Clean up duplicated or messy tailwind resulting from naive replacement
    content = content.replace(/bg-white border-gray-200 shadow-sm border border-gray-200 shadow-sm/g, "bg-white border border-gray-200 shadow-sm");
    content = content.replace(/bg-white border-gray-200 shadow-sm border-gray-200/g, "bg-white border-gray-200 shadow-sm");
    
    if (content !== initial) {
        fs.writeFileSync(file, content, "utf8");
        console.log("Updated", file);
        changedCount++;
    }
});

console.log(`Updated ${changedCount} files.`);

