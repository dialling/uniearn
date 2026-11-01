// Keep legacy single-photo orders readable while new orders carry a gallery.
function paths(request={}){
 const photos=Array.isArray(request.riderPhotos)?request.riderPhotos:[request.riderPhoto];
 return [...new Set(photos.filter(photo=>typeof photo==='string'&&photo))];
}
module.exports={paths};
