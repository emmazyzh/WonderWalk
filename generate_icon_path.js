const fs = require('fs');
const d3Geo = require('d3-geo');

const geojson = JSON.parse(fs.readFileSync('public/data/china-provinces.json', 'utf8'));

// create a projection that fits in a 64x64 box
let projection = d3Geo.geoMercator().fitSize([64, 64], geojson);
let pathGenerator = d3Geo.geoPath().projection(projection);

// just get the paths for all provinces and concatenate them?
// Actually if we just stroke the provinces, it will have borders. But if we stroke it lightly, it might look like a detailed map!
// Or better, we can union them if we have topojson. But without topojson, drawing all provinces inside a 64x64 SVG icon might still be messy if lines are thick.
// Wait, for an icon, drawing all province boundaries at 64x64 is definitely "messy irregular lines".
// Can we just get the bounding box or outline?
// We can use @turf/union if it's installed. Let's check if turf is installed!
