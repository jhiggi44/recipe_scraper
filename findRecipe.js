'use strict';
const inquirer = require('inquirer'), fs = require('fs'),
scrape = require('./scraping/scrape.js'); 
let recipes = [], index = 0;
promptForRecipe();
function convertToTxtFile(recipeName, recipe) {
    inquirer.prompt({
        type: 'input',
        name: 'filePath',
        message: "Where do you want to save this recipe? Include path relative to this program's location and name of the file. \nExample: ../recipes/lasagna.txt"
    }).then((answer) => {
        fs.writeFile(answer.filePath, recipe, function (err) {
            if (err) throw err;
            console.log(`Successfully saved ${recipeName} recipe to ${answer.filePath}.`);
            promptForNextAction(recipeName);
        });
    });
}
function promptForNextAction(recipeName) {
    inquirer.prompt({
        type: 'list',
        name: 'nextAction',
        message: "Anything else?",
        choices: [`Convert recipe to txt file.`, `View another recipe for ${recipeName}.`, `Search for a new recipe.`]
    }).then((answer) => {
        if (answer.nextAction == "Convert recipe to txt file.") {
            const recipe = `From: ${recipes[index].url}\n${recipes[index].ingredients}\n${recipes[index].instructions}`;
            convertToTxtFile(recipeName, recipe);
        }
        if (answer.nextAction == `View another recipe for ${recipeName}.`) {
            index++;
            if (index >= recipes.length) {
                console.log(`Looks like there are no more recipes for ${recipeName} in the list. Try another search...`);
                promptForRecipe();
            } else {
                const recipe = `From: ${recipes[index].url}\n${recipes[index].ingredients}\n${recipes[index].instructions}`;
                console.log(recipe);
                promptForNextAction(recipeName);
            }
        }
        if (answer.nextAction == "Search for a new recipe.") {
            promptForRecipe();
        }
    });
}
function promptForRecipe() {
    inquirer.prompt({
        type: 'input',
        name: 'recipeName',
        message: "What do you want to make?"
    }).then((answer) => {
        let recipesPromised = scrape(answer.recipeName);
        index = 0;
        recipesPromised.then((results) => {
            recipes = results;
            const recipe = `From: ${recipes[index].url}\n${recipes[index].ingredients}\n${recipes[index].instructions}`;
            console.log(recipe);
            promptForNextAction(answer.recipeName);
        });
    });
}