/*export */ class eventlog {
    constructor(id, type,status,err,number,apikey) {
        this.id = id;
        this.type = type;
        this.status = status;
        this.err = err;
        this.number = number;
        this.apikey = apikey;
      

    }
}

module.exports = {
    eventlog: eventlog
};