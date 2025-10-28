# Step 1: Use a Node base image
FROM node:18-alpine

# Step 2: Create app directory
WORKDIR /usr/src/app

# Step 3: Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Step 4: Copy rest of the source code
COPY . .

# Step 5: Expose app port
EXPOSE 4000

# Step 6: Set environment
ENV NODE_ENV=production

# Step 7: Start the app
CMD ["node", "index.js"]
