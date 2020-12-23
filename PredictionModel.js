class PredictionModel{

  constructor(){
  }
 async  predict(screenshot,available_models){
    let result= await Promise.all(available_models.filter(item=>item.selected).map(function(item){
        let model = eval("new " + item.name + "()");
         return model.predict(screenshot);
     }));
     console.log(result);
    let enabled_models=result.length;
    if(enabled_models===0){
      return {
        site:"NaN",
      }
    }else if(enabled_models===1){
      result=result[0];
      return {
        site:result.site,
        confidence:(100).toFixed(2),
        image:result.image

     }
    }
    result=result.filter(x=>x.site!=="NaN");
    let map=new Map();
    let max=0;let correct_model;
    result.forEach(function (x){
        if( map.has(x.site)){
          map.set(x.site,map.get(x.site)+1);
        }else{
          map.set(x.site,1);
        }
       if( map.get(x.site)>max){
         max=map.get(x.site);
         correct_model=x;
       }
    })
    if(max<2){
      return {
        site:"NaN",
      }
    }


     return {
      site:correct_model.site,
      confidence:((max/enabled_models)*100).toFixed(2),
      image:correct_model.image

   }



  }
}