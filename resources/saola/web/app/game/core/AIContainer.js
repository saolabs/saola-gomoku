import C5_Demo from "../models/C5-demo";
import C5_2025 from "../models/C5-2025";
import BOT_Origin from "../models/BOT_Origin";
import UCT_Independent from "../models/UCT_Independent";
export class AIContainer {
    /**
     * @type {BaseModel[]}
     */
    models = [
        BOT_Origin,
        UCT_Independent,
        C5_Demo, 
        C5_2025
    ];
    /**
     * @type {{[key: string]: {name: string, version: string, author: string, description: string, rules: string[], examples: string[], parameters: string[], results: string[], author: string, copyright: string, license: string, website: string, model: BaseModel}}}
     */
    modelsData = {};
    /**
     * @type {CorrectFiveGame}
     */
    game = null;
    constructor(game){
        this.game = game;
        this.modelsData = this.loadModels();
    }
    loadModels(){
        let data = {};
        this.models.forEach(model => {
            data[model.NAME] = {
                name: model.NAME,
                version: model.VERSION,
                author: model.AUTHOR,
                description: model.DESCRIPTION,
                rules: model.RULES,
                examples: model.EXAMPLES,
                parameters: model.PARAMETERS,
                results: model.RESULTS,
                copyright: model.COPYRIGHT,
                license: model.LICENSE,
                website: model.WEBSITE,
                model: model,
                instance: null
            }
        });
        return data;
    }
    /**
     * @param {string} name
     * @returns {BaseModel}
     */
    getModel(name){
        if(!this.modelsData[name]){
            throw new Error(`Model ${name} not found`);
        }
        return this.modelsData[name];
    }
    /**
     * @param {string} name
     * @returns {BaseModel}
     */
    getModelInstance(name){
        if(!this.modelsData[name]){
            throw new Error(`Model ${name} not found`);
        }
        if(!this.modelsData[name].instance){
            this.modelsData[name].instance = new this.modelsData[name].model(this.game);
        }
        return this.modelsData[name].instance;
    }
    
    getModels(){
        return this.modelsData;
    }
}
export default AIContainer;
