/*export */ class messagelog {
    constructor(id, domain,number,apikey,licenceKey,sentDate) {
        this.id = id;
        this.domain = domain;
        this.number = number;
        this.apikey = apikey;
        this.licenceKey = licenceKey;
        this.sentDate = sentDate;
    }
}

module.exports = {
    messagelog : messagelog
};