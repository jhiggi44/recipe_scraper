// https://www.google.com/search?q=
// block youtube, allrecipes, foodnetwork
// make custom for https://tastesbetterfromscratch.com/
const request = require('request'), 
cheerio = require('cheerio');

function searchHeadersForSelectors($) {
    let instructions = null;
    let ingredients = null;
    for (let i = 1; i < 7; i++) {
        // console.log(`h${i}`);
        $(`h${i}`).each(function(i, el) {
            if ($(this).text().toLowerCase().includes("instructions") || $(this).text().toLowerCase().includes("directions") 
            || $(this).text().toLowerCase().includes("steps") || $(this).text().toLowerCase().includes("make")) {
                let newInstructions = $(this).parent();
                if (newInstructions.children().length < 2) {
                    newInstructions = newInstructions.parent();
                }
                instructions = chooseBestInstructions(instructions, newInstructions);
            }
            if ($(this).text().toLowerCase().includes("ingredients")) {
                let newIngredients = $(this).parent();
                if (newIngredients.children().length < 2) {
                    newIngredients = newIngredients.parent();
                }
                ingredients = chooseBestIngredients(instructions, newIngredients);
            }
        });
    }
    return { instructions: instructions, ingredients: ingredients };
}
function searchDivsForSelectors($, instructions, ingredients) {
    console.log("finding ingredient and direction selectors in divs...");
    $('div').each(function(i, el) {
        if (($(this).text().toLowerCase().includes("instructions") || $(this).text().toLowerCase().includes("directions") 
        || $(this).text().toLowerCase().includes("steps") || $(this).text().toLowerCase().includes("make")) && $(this).text().length < 30) {
            let newInstructions = $(this).parent();
            if (newInstructions.children().length < 2) { // try a while loop to break nested (one element crap)
                newInstructions = newInstructions.parent();
            }
            instructions = chooseBestInstructions(instructions, newInstructions); 
        }
        if ($(this).text().toLowerCase().includes("ingredients") && $(this).text().length < 15) {
            let newIngredients = $(this).parent();
            if (newIngredients.children().length < 2) {
                newIngredients = newIngredients.parent();
            }
            ingredients = chooseBestIngredients(instructions, newIngredients); 
        }
    });
}
function chooseBestInstructions(current, noob) {
    if (!current) {
        return noob;
    }
    if ((!current.text().toLowerCase().includes("instructions") || !current.text().toLowerCase().includes("directions"))
    && (noob.text().toLowerCase().includes("instructions") || noob.text().toLowerCase().includes("directions"))) {
        return noob;
    }
    if (current.text().includes("@") && !noob.text().includes("@")) {
        return noob;
    }
    if (current.text().length > noob.text().length && !noob.text().includes("@")) {
        return noob;
    }
    return current;
}
function chooseBestIngredients(current, noob) {
    if (!current) {
        return noob;
    }
    if (current.text().includes("<") && !noob.text().includes("<")) {
        return noob;
    }
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
            const $ = cheerio.load(body);
            // console.log(body);
            let recipeObj = {
                url: url,
            }
            let selectors = searchHeadersForSelectors($);
            if (!selectors.instructions || !selectors.ingredients) {
                searchDivsForSelectors($, selectors.instructions, selectors.ingredients);
            }
            // recipeObj.ingredientSelector = chooseBestSelector(selectors.ingredients);
            // recipeObj.instructSelector = chooseBestSelector(selectors.instructions);
            recipeObj.instructions = selectors.instructions;
            recipeObj.ingredients = selectors.ingredients;
            if (!recipeObj.ingredients || !recipeObj.instructions) {
                resolve(null);
            } else {
                // console.log(recipeObj.ingredientSelector.text());
                resolve(recipeObj);
            }
        });
    });
}
async function visitURLs(urls) {
    let recipeObjArr = [];
    // for (let i = 0; i < urls.length; i++) {
    for (let i = 0; i < 1; i++) {
        console.log("searching... " + urls[i]);
        try {
            await searchForRecipe(urls[i]).then((result) => {
                if (result) {
                    recipeObjArr.push(result);
                } else {
                    console.log("Recipe NOT found...");
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
module.exports = function searchGoogleForURLs(query) {
    request(`http://www.google.com/search?q=${query} blog recipe`, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        // console.log('body:', body); // Print the HTML for the Google homepage.
        const $ = cheerio.load(body),
        // initialize variables
        links = $(".r a"), urls = [], sitesToAvoid = ["foodnetwork", "allrecipes"];
        links.each(function (i, link) {
            let url = $(link).attr("href"); // get the href attribute of each link
            url = url.replace("/url?q=", "").split("&")[0]; // strip out unnecessary junk
            if (url.charAt(0) === "/") {
                return;
            }
            const siteName = url.split(".")[1];
            if (!sitesToAvoid.includes(siteName)) { 
                urls.push(url);
            } else {
                console.log("Avoiding site");
            }
        });
        console.log("urls found: " + urls.length);
        let promiseOfRecipes = visitURLs(urls);
        promiseOfRecipes.then((result) => {
            console.log(`recipes found: ${result.length}.`);
            for (let i = 0; i < result.length; i++) {
                if (result[i].instructions.text() == result[i].ingredients.text()) {
                    console.log(`${i}. SITE ${result[i].url}`);
                    console.log(`${i}. BOTH BOTH ${result[i].instructions.text()}`);
                } else {
                    console.log(`${i}. SITE ${result[i].url}`);
                    console.log(`${i}. INSTRUCTIONS ${result[i].instructions.text()}`);
                    console.log(`${i}. INGREDIENTS ${result[i].ingredients.text()}`);
                }
            }
        }).catch((error) => {
            console.log(error);
        });
        
    });
}