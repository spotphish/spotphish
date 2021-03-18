window.predict = async function predict(screenshot, available_models) {
  GPU_BUSY = true;
  let total = available_models.filter(item => item.selected).reduce(function (total, num) {
    return total + num.weightage;
  }, 0);
  if (total !== 100) {
    alert("Please corrects the weights.")
    ROOT_DIR = undefined;
    return;
  }

  let result = await Promise.all(available_models.filter(item => item.selected).map(async function (item) {
    // let model = eval("new " + item.name + "()");
    let Model;
    Model = (await import(item.src)).default;
    ROOT_DIR = item.root

    let x = new Model();
    if (item.webgl) {
      if (webglStatus) {
        let z;
        try {
          let startTime = performance.now()
          z = await x.predict(screenshot);
          console.log(performance.now() - startTime);
        } catch (e) {
          console.log(e)
          ROOT_DIR = undefined

          return {
            site: "NaN",
            weightage: item.weightage
          }
        }
        ROOT_DIR = undefined
        return {
          ...z,
          weightage: item.weightage
        }
      } else {
        // alert("Webgl not present. Skipped " + item.label);
        ROOT_DIR = undefined

        return {
          site: "NaN",
          weightage: item.weightage
        }
      }
    } else {
      let z;
      try {
        let startTime = performance.now()
        z = await x.predict(screenshot);
        console.log(performance.now() - startTime);

      } catch (e) {
        ROOT_DIR = undefined
        return {
          site: "NaN",
          weightage: item.weightage
        }
      }
      ROOT_DIR = undefined

      return {
        ...z,
        weightage: item.weightage
      }
    }


  }));

  let enabled_models = result.length;
  if (enabled_models === 0) {
    ROOT_DIR = undefined;

    return {
      site: "NaN",
    }
  } else if (enabled_models === 1) {
    result = result[0];
    ROOT_DIR = undefined;

    return {
      site: result.site,
      confidence: result.weightage,
      image: result.image

    }
  }
  result = result.filter(x => x.site !== "NaN");
  if (result.length === 0) {
    ROOT_DIR = undefined;

    return {
      site: "NaN"
    }
  }
  let map = new Map();
  let max = 0;
  let correct_model;
  result.forEach(function (x) {
    x.site = x.site.toLowerCase().replace(/\s+/g, '');
    if (map.has(x.site)) {
      map.set(x.site, map.get(x.site) + x.weightage);
    } else {
      map.set(x.site, x.weightage);
    }
    if (map.get(x.site) > max) {
      max = map.get(x.site);
      correct_model = x;
    }
  })
  ROOT_DIR = undefined;
  return {
    site: correct_model.site,
    confidence: max,
    image: correct_model.image
  }
}