const EntitySchema = require("typeorm").EntitySchema;
const eventlog = require("../model/eventlog").eventlog;

module.exports = new EntitySchema({
    name: "eventlog",
    target: eventlog,
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        type: {
            type: "varchar"
        },
        status: {
            type: "varchar"
        },
        err: {
            type: "text"
        },
        number: {
            nullable: true,
            type: "varchar"
        },
        apikey: {
            nullable: true,
            type: "varchar"
        },

    }
});