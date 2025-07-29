# 🚀 This is the general backend setup

All the instruction will be updated here by the time we process

# Changes to make

1. "types": "module"
2. "dev": "nodemon src/index.js"
3. create .prettierrc file for configuration
4. create .prettierignore file

# Dependencies to install

1. npm i -D nodemon
2. npm i -D prettier

###################################################################

# To load the env file from package.json

    "dev": "nodemon -r dotenv/config --experimental-json-modules src/index.js"
    or we can remove the --experimental-json-modules
