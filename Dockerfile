FROM node
WORKDIR /APP

COPY package.json ./

RUN npm install

COPY . .

CMD ["node", "example.js"]
