const EntitySchema = require("typeorm").EntitySchema;
const sessions = require("../model/sessions").sessions;

module.exports = new EntitySchema({
    name: "sessions",
    target: sessions,
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        session: {
            type: "json"
        },
        number: {
            type: "varchar"
        },
        apikey: {
            type: "varchar"
        },
        isActive: {
            type: "int"
        },
        url: {
            type: "varchar"
        },
        licenceKey: {
            type: "varchar"
        },
        statusurl: {
            type: "varchar"
        },

    }
});