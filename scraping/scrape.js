const request = require('request'), cheerio = require('cheerio');
function searchHeadersForSelectors($) {
    let instructions = null;
    let ingredients = null;
    // 7 because there are header tags h1 through h6, search all htags
    for (let i = 1; i < 7; i++) {
        $(`h${i}`).each(function(i, el) {
            if ($(this).text().toLowerCase().includes("instructions") || $(this).text().toLowerCase().includes("directions") 
            || $(this).text().toLowerCase().includes("steps") || $(this).text().toLowerCase().includes("make")) {
                let newInstructions = $(this).parent();
                if (newInstructions.children().length < 2) { // if the parent only has one child, we need to grab its parent to get the content we want
                    newInstructions = newInstructions.parent();
                }
                instructions = chooseBestInstructions(instructions, newInstructions);
            }
            if ($(this).text().toLowerCase().includes("ingredients")) {
                let newIngredients = $(this).parent();
                if (newIngredients.children().length < 2) { // same as above
                    newIngredients = newIngredients.parent();
                }
                ingredients = chooseBestIngredients(ingredients, newIngredients);
            }
        });
    }
    return { instructions: instructions, ingredients: ingredients };
}
function searchTagForSelectors($, tagType, instructions, ingredients) {
    // console.log("finding ingredient and direction selectors in different tag types...");
    $(`${tagType}`).each(function(i, el) {
        if (($(this).text().toLowerCase().includes("instructions") || $(this).text().toLowerCase().includes("directions") 
        || $(this).text().toLowerCase().includes("steps") || $(this).text().toLowerCase().includes("make")) && $(this).text().length < 30) {
            let newInstructions = $(this).parent();
            if (newInstructions.children().length < 2) { // if the parent only has one child, we need to grab its parent to get the content we want
                newInstructions = newInstructions.parent();
            }
            instructions = chooseBestInstructions(instructions, newInstructions); 
        }
        if ($(this).text().toLowerCase().includes("ingredients") && $(this).text().length < 15) {
            let newIngredients = $(this).parent();
            if (newIngredients.children().length < 2) { // same as above
                newIngredients = newIngredients.parent();
            }
            ingredients = chooseBestIngredients(ingredients, newIngredients); 
        }
    });
}
function chooseBestInstructions(current, noob) {
    if (!current) { // if there isn't an established instruction selector, start with this one
        return noob;
    }
    // if the previous tag was selected because of the keywords "make" or "step", which are less acurate than "directions" and "instructions", switch selector to the new one
    if ((!current.text().toLowerCase().includes("instructions") || !current.text().toLowerCase().includes("directions"))
    && (noob.text().toLowerCase().includes("instructions") || noob.text().toLowerCase().includes("directions"))) {
        return noob;
    }
    // This is to help eliminate grabbing the erroneous (and common) "Did you make this recipe? Tell us about it @instagramHandle"
    if (current.text().includes("@") && !noob.text().includes("@")) {
        return noob;
    }
    // This assumption is based purely on what I've seen while creating this, but the shorter .text() is usually the more accurate one. 
    if (current.text().length > noob.text().length && !noob.text().includes("@")) {
        return noob;
    }
    return current;
}
function chooseBestIngredients(current, noob) {
    if (!current) { // start with first selector identified. 
        return noob;
    }
    // the selector with content including common ingredient measurements is better
    if (noob.text().includes("tsp") || noob.text().includes("oz") || noob.text().includes("cup") ||
    noob.text().includes("teaspoon") || noob.text().includes("ounce")) {
        return noob;
    }
    // "<" indicate the scraper has picked up a html tag, which happens while looking for ingredients for some reasons. This = no bueno.
    if (current.text().includes("<") && !noob.text().includes("<")) {
        return noob;
    }
    // shorter content tends to be better, based solely on my observations
    if (noob.text().length < current.text().length) {
        return noob;
    }
    return current;
}
async function searchForRecipe(url) {
    return new Promise((resolve, reject) => {
        request({ 
            method: 'GET', 
            uri: url, 
            gzip: true
        }, url, function (error, response, body) {
            if (error) {
                reject(error);
            }
            const $ = cheerio.load(body, {
                normalizeWhitespace: true,
                xmlMode: true
            });
            let recipeObj = {
                url: url,
            }
            let selectors = searchHeadersForSelectors($);
            // if recipe isn't found by searching through the htags, seach divs.
            if (!selectors.instructions || !selectors.ingredients) {
                searchTagForSelectors($, "div", selectors.instructions, selectors.ingredients);
            }
            // if recipe isn't found by searching through the htags, seach ptags.
            if (!selectors.instructions || !selectors.ingredients) {
                searchTagForSelectors($, "p", selectors.instructions, selectors.ingredients);
            }
            recipeObj.instructions = selectors.instructions;
            recipeObj.ingredients = selectors.ingredients;
            if (!recipeObj.ingredients || !recipeObj.instructions) {
                resolve(null);
            } else {
                resolve(recipeObj);
            }
        });
    });
}
async function scanSitesForRecipe(urls) {
    let recipeObjArr = [];
    for (let i = 0; i < urls.length; i++) {
        console.log(`Searching ${urls[i]}...`);
        try {
            await searchForRecipe(urls[i]).then((result) => {
                if (result) {
                    recipeObjArr.push(result);
                } 
            });
        } catch(error) {
            console.log(`ERROR: ${error}`);
        };
    }
    return new Promise((resolve, reject) => {
        if (recipeObjArr.length != 0) {
            resolve(recipeObjArr);
        } else {
            reject("No recipes found...");
        }
    });
}
module.exports = async function searchGoogleForURLs(query) {
    return new Promise((resolve, reject) => {
        request(`http://www.google.com/search?q=${query} blog recipe`, function (error, response, body) {
            if (error) {
                console.log('error:', error); // Print the error if one occurred
            }
            const $ = cheerio.load(body),
            links = $(".r a"), sitesToAvoid = ["foodnetwork", "allrecipes", "youtube", "badURL"], urls = [], recipes = [];
            links.each(function (i, link) {
                let url = $(link).attr("href"); // get the href attribute of each link
                url = url.replace("/url?q=", "").split("&")[0]; // strip out unnecessary junk
                // if (url.charAt(0) === "/") {
                //     return;
                // }
                let siteName = "badURL";
                if (url.includes(".")) {
                    siteName = url.split(".")[1];
                } 
                if (!sitesToAvoid.includes(siteName)) { // to avoid sites I don't want to visit
                    urls.push(url);
                } 
            });
            // console.log("urls found: " + urls.length);
            let promiseOfRecipes = scanSitesForRecipe(urls);
            promiseOfRecipes.then((result) => {
                console.log(`recipes found: ${result.length}.`);
                for (let i = 0; i < result.length; i++) {
                    if (result[i].instructions.text() == result[i].ingredients.text()) {
                        let instructionStr = "", children = result[i].instructions.children();
                        for (let j = 0; j < children.length; j++) {
                            instructionStr += children.eq(j).text().trim() + "\n";
                        }
                        recipes.push({
                            url: result[i].url,
                            instructions: instructionStr,
                            ingredients: null
                        });
                    } else {
                        let instructionStr = "", ingredientStr = "", 
                        childInstructions = result[i].instructions.children(), 
                        childIngredients = result[i].ingredients.children();
                        for (let j = 0; j < childInstructions.length; j++) {
                            instructionStr += childInstructions.eq(j).text().trim() + "\n";
                        }
                        for (let j = 0; j < childIngredients.length; j++) {
                            ingredientStr += childIngredients.eq(j).text().trim() + "\n";
                        }
                        recipes.push({
                            url: result[i].url,
                            instructions: instructionStr,
                            ingredients: ingredientStr
                        });
                    }
                }
                if (!recipes) {
                    resolve(null);
                } else {
                    resolve(recipes);
                }
            }).catch((error) => {
                console.log(error);
            }); 
        });
    });
}