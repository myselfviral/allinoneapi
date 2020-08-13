/*export */ class sessions {
    constructor(id, session,number,apikey,isActive,url,licenceKey,statusurl) {
        this.id = id;
        this.session = session;
        this.number = number;
        this.apikey = apikey;
        this.isActive = isActive;
        this.url = url;
        this.licenceKey = licenceKey;
        this.statusurl = statusurl;

    }
}

module.exports = {
    sessions: sessions
};