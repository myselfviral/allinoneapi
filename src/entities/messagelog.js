const EntitySchema = require("typeorm").EntitySchema;
const messagelog = require("../model/messagelog").messagelog;

module.exports = new EntitySchema({
    name: "messagelog",
    target: messagelog,
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        domain: {
            type: "varchar"
        },
        number: {
            type: "varchar"
        },
        apikey: {
            type: "varchar"
        },
        licenceKey: {
            type: "varchar"
        },
        sentDate: {
            type: "datetime"
        },

    }
});