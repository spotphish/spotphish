window.predict=  async function  predict(screenshot,available_models){
 let total= available_models.filter(item=>item.selected).reduce(function (total, num) {
    return total + num.weightage;
}, 0);
if(total!==100){
  alert("Please corrects the weights.")
  return;
}
let webglStatus=webgl_detect();

  let result= await Promise.all(available_models.filter(item=>item.selected).map(async function(item){
      // let model = eval("new " + item.name + "()");
     let Model;
     Model=(await import(item.src)).default;
      let x=new Model();


      if(item.webgl){
        if(webglStatus){
          let z=await x.predict(screenshot);
          return {
            ...z,
            weightage:item.weightage
          }
        }else{
          alert("Webgl not present. Skipped "+item.label);
          return {
            site:"NaN",
            weightage:item.weightage

          }
        }
      }else{
      let z=await  x.predict(screenshot);
      return {
        ...z,
        weightage:item.weightage
      }
    }


  }));

  let enabled_models=result.length;
  if(enabled_models===0){
    return {
      site:"NaN",
    }
  }else if(enabled_models===1){
    result=result[0];
    return {
      site:result.site,
      confidence:result.weightage,
      image:result.image

   }
  }
  console.log(result);
  result=result.filter(x=>x.site!=="NaN");
  if(result.length===0){
    return{
      site:"NaN"
    }
  }
  let map=new Map();
  let max=0;let correct_model;
  result.forEach(function (x){
  x.site= x.site.toLowerCase().replace(/\s+/g, '');
    if( map.has(x.site)){
        map.set(x.site,map.get(x.site)+x.weightage);
      }else{
        map.set(x.site,x.weightage);
      }
     if( map.get(x.site)>max){
       max=map.get(x.site);
       correct_model=x;
     }
  })
   return {
    site:correct_model.site,
    confidence:max,
    image:correct_model.image
   }
}
function webgl_detect()
{
    if (!!window.WebGLRenderingContext) {
        var canvas = document.createElement("canvas"),
             names = ["webgl2", "webgl", "experimental-webgl", "moz-webgl", "webkit-3d"],
           context = false;

        for(var i=0;i< names.length;i++) {
            try {
                context = canvas.getContext(names[i]);
                if (context && typeof context.getParameter == "function") {
                    // WebGL is enabled

                    // else, return just true
                    return true;
                }
            } catch(e) {}
        }

        // WebGL is supported, but disabled
        alert("Enable Webgl flag")
        return false;
    }

    // WebGL not supported
    alert("Webgl not supported on this device")

    return false;
}