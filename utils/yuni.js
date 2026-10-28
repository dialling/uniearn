const defs=[['hello','wave','Hello!','Sign in to Uniearn.'],['post','party','First post','Post your first order or task.'],['run','go','On my way','Take your first job as a runner.'],['chat','phone','Say hi','Send a message to your runner or student.'],['thanks','happy','Thank you','Confirm an order is done.'],['paid','earn','Got paid','Get paid for a job you ran.']];
function stickers(){return defs.map(([id,pose,name,how])=>({id,pose,name,how,unlocked:true}));}
module.exports={stickers};
