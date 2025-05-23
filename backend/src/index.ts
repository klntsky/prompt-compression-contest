import "reflect-metadata"
import AppDataSource from "./data-source"

AppDataSource.initialize().then(() => {
        // here you can start to work with your database
    }).catch((error) => console.log(error))