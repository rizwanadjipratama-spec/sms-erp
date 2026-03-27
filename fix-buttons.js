const fs = require("fs");

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

let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, "utf8");
    let initial = content;
    
    // Any className that contains bg-<color>-500,600,700 and text-gray-900 should probably be text-white
    // Instead of regex matching, let us replace text-gray-900 with text-white if the same className quote block contains a dark bg.
    // A safer way:
    content = content.replace(/(bg-[a-z]+-[567]00[^"}]*?)text-gray-900/g, "$1text-white");
    // Also covers cases where text-gray-900 comes before the bg
    content = content.replace(/text-gray-900([^"}]*?bg-[a-z]+-[567]00)/g, "text-white$1");

    if (content !== initial) {
        fs.writeFileSync(file, content, "utf8");
        changedCount++;
    }
});

console.log(`Updated ${changedCount} files for button text colors.`);

