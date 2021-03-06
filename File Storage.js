
exports.newFileStorage = function newFileStorage(BOT) {

    const FULL_LOG = true;
    const LOG_FILE_CONTENT = false;

    let bot = BOT;
    const ROOT_DIR = './';

    const MODULE_NAME = "File Storage";

    var util = require('util');
    var guid = require('node-uuid');
    var crypto = require('crypto');
    var storage = require('azure-storage');

    const DEBUG_MODULE = require('./Debug Log');
    const logger = DEBUG_MODULE.newDebugLog();
    logger.fileName = MODULE_NAME;
    logger.bot = bot;

    const shareName = 'data';
    let dataOwner;

    let thisObject = {
        initialize: initialize,
        createFolder: createFolder,
        createTextFile: createTextFile,
        getTextFile: getTextFile,
        listFilesAndFolders: listFilesAndFolders
    };

    let fileService;

    return thisObject;


    function initialize(pDataOwnerBotCodeName, callBackFunction) {

        try {

            if (pDataOwnerBotCodeName === undefined) {
                dataOwner = bot.codeName;
            } else {
                dataOwner = pDataOwnerBotCodeName;
            }

            logger.fileName = MODULE_NAME + '.' + dataOwner;

            if (FULL_LOG === true) { logger.write("[INFO] initialize -> Entering function."); }

            readConnectionStringConfigFile(onConnectionStringReady);

            function onConnectionStringReady(err, pConnObj) {

                if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                    logger.write("[ERROR] initialize -> onConnectionStringReady -> err = " + err.message);
                    callBackFunction(err);
                    return;
                }

                try {
                    fileService = storage.createFileService(pConnObj.connectionString);
                    callBackFunction(global.DEFAULT_OK_RESPONSE);

                } catch (err) {

                    logger.write("[ERROR] initialize -> onConnectionStringReady -> createFileService -> err = " + err.message);
                    callBackFunction(err);
                    return;
                }
            }

            function readConnectionStringConfigFile(callBack) {

                let filePath;

                try {
                    let fs = require('fs');
                    filePath = '../' + 'Connection-Strings' + '/' + global.STORAGE_CONN_STRING_FOLDER + '/' + dataOwner + '.azure.storage.connstring';
                    let connObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                    callBack(global.DEFAULT_OK_RESPONSE, connObj);
                }
                catch (err) {
                    logger.write("[ERROR] readConnectionStringConfigFile -> err = " + err.message);
                    logger.write("[HINT] readConnectionStringConfigFile -> You need to have a file at this path -> " + filePath);
                    logger.write("[HINT] readConnectionStringConfigFile -> The file must have the connection string to the Azure Storage Account. Request the file to an AA Team Member if you dont have it.");
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }
        }
        catch (err) {
            logger.write("[ERROR] initialize -> err = " + err.message);
            callBack(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function createFolder(pFolderPath, callBackFunction) {

        if (FULL_LOG === true) { logger.write("[INFO] createFolder -> Entering function."); }

        if (fileService === undefined) {

            logger.write("[ERROR] createFolder -> initialize function not executed or failed. Can not process this request. Sorry.");
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
            return;
        }

        try {

            fileService.createDirectoryIfNotExists(shareName, pFolderPath, onFolderCreated);

            function onFolderCreated(err, result, response) {

                if (err) {

                    logger.write("[ERROR] createFolder -> onFolderCreated -> err = " + JSON.stringify(err));
                    logger.write("[ERROR] createFolder -> onFolderCreated -> result = " + JSON.stringify(result));
                    logger.write("[ERROR] createFolder -> onFolderCreated -> response = " + JSON.stringify(response));

                    if (err.code === 'ServerBusy'
                        || err.code === 'ECONNRESET'
                        || err.code === 'ENOTFOUND'
                        || err.code === 'ESOCKETTIMEDOUT'
                        || err.code === 'ETIMEDOUT'
                        || err.code === 'ECONNREFUSED') {

                        setTimeout(secondTry, 1000);
                        return;

                        function secondTry() {

                            logger.write("[INFO] createFolder -> onFolderCreated -> secondTry -> Retrying to create the folder.");

                            fileService.createDirectoryIfNotExists(shareName, pFolderPath, onSecondTry);

                            function onSecondTry(err, result, response) {

                                if (err) {
                                    logger.write("[ERROR] createFolder -> onFolderCreated -> secondTry -> Folder not created. Giving Up.");
                                    callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                } else {
                                    logger.write("[INFO] createFolder -> onFolderCreated -> secondTry -> Folder succesfully created on second try.");
                                    callBackFunction(global.DEFAULT_OK_RESPONSE);
                                }
                            }
                        }
                    }

                    logger.write("[ERROR] createFolder -> onFolderCreated -> Dont know what to do here. Cancelling operation. ");
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);

                } else {
                    if (FULL_LOG === true) { logger.write("[INFO] createFolder -> onFolderCreated -> File Created."); }
                    callBackFunction(global.DEFAULT_OK_RESPONSE);
                }
            }
        }
        catch (err) {
            logger.write("[ERROR] createFolder -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function createTextFile(pFolderPath, pFileName, pFileContent, callBackFunction) {

        if (fileService === undefined) {

            logger.write("[ERROR] createTextFile -> initialize function not executed or failed. Can not process this request. Sorry.");
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
            return;
        }

        try {

            if (FULL_LOG === true) {
                logger.write("[INFO] createTextFile -> About to create a text file.");
                logger.write("[INFO] createTextFile -> shareName = " + shareName);
                logger.write("[INFO] createTextFile -> pFolderPath = " + pFolderPath);
                logger.write("[INFO] createTextFile -> pFileName = " + pFileName);
            }

            fileService.createFileFromText(shareName, pFolderPath, pFileName, pFileContent, onFileCreated);

            function onFileCreated(err, result, response) {

                if (FULL_LOG === true) {
                    logger.write("[INFO] createTextFile -> onFileCreated -> Response from Azure received.");
                    logger.write("[INFO] createTextFile -> onFileCreated -> err = " + JSON.stringify(err));
                    logger.write("[INFO] createTextFile -> onFileCreated -> result = " + JSON.stringify(result));
                    logger.write("[INFO] createTextFile -> onFileCreated -> response = " + JSON.stringify(response));
                }

                if (err) {

                    logger.write("[ERROR] createTextFile -> onFileCreated -> err = " + JSON.stringify(err));
                    logger.write("[ERROR] createTextFile -> onFileCreated -> result = " + JSON.stringify(result));
                    logger.write("[ERROR] createTextFile -> onFileCreated -> response = " + JSON.stringify(response));

                    if (err.code === 'ServerBusy'
                        || err.code === 'ECONNRESET'
                        || err.code === 'ENOTFOUND'
                        || err.code === 'ESOCKETTIMEDOUT'
                        || err.code === 'ETIMEDOUT'
                        || err.code === 'ECONNREFUSED') {

                        setTimeout(secondTry, 1000);
                        return;

                        function secondTry() {

                            logger.write("[INFO] createTextFile -> onFileCreated -> secondTry -> Retrying to create the file.");

                            fileService.createFileFromText(shareName, pFolderPath, pFileName, pFileContent, onSecondTry);

                            function onSecondTry(err, result, response) {

                                if (err) {
                                    logger.write("[ERROR] createTextFile -> onFileCreated -> secondTry -> File not created. Giving Up.");
                                    callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                } else {
                                    logger.write("[INFO] createTextFile -> onFileCreated -> secondTry -> File succesfully created on second try.");
                                    callBackFunction(global.DEFAULT_OK_RESPONSE);
                                }
                            }
                        }
                    }

                    logger.write("[ERROR] createTextFile -> onFileCreated -> Dont know what to do here. Cancelling operation. ");
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);

                } else {
                    if (FULL_LOG === true) { logger.write("[INFO] createTextFile -> onFileCreated -> File Created."); }
                    callBackFunction(global.DEFAULT_OK_RESPONSE);
                }
            }
        }
        catch (err) {
            logger.write("[ERROR] 'createTextFile' -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function getTextFile(pFolderPath, pFileName, callBackFunction) {

        if (fileService === undefined) {

            logger.write("[ERROR] getTextFile -> initialize function not executed or failed. Can not process this request. Sorry.");
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
            return;
        }

        try {

            if (FULL_LOG === true) {
                logger.write("[INFO] getTextFile -> About to get a text file.");
                logger.write("[INFO] getTextFile -> shareName = " + shareName);
                logger.write("[INFO] getTextFile -> pFolderPath = " + pFolderPath);
                logger.write("[INFO] getTextFile -> pFileName = " + pFileName);
            }

            fileService.getFileToText(shareName, pFolderPath, pFileName, undefined, onFileReceived);

            function onFileReceived(err, text, response) {

                if (FULL_LOG === true) {
                    logger.write("[INFO] getTextFile -> onFileReceived -> Response from Azure received.");
                    logger.write("[INFO] getTextFile -> onFileReceived -> err = " + JSON.stringify(err));
                    logger.write("[INFO] getTextFile -> onFileReceived -> response = " + JSON.stringify(response));
                }

                if (LOG_FILE_CONTENT === true) {
                    logger.write("[INFO] getTextFile -> onFileReceived -> text = " + text);
                }

                if (err) {
                
                    if (err.code === 'ServerBusy'
                        || err.code === 'ECONNRESET'
                        || err.code === 'ENOTFOUND'
                        || err.code === 'ESOCKETTIMEDOUT'
                        || err.code === 'ETIMEDOUT'
                        || err.code === 'ECONNREFUSED') {
                            
                        setTimeout(secondTry, 1000);
                        return;

                        function secondTry() {

                            logger.write("[INFO] getTextFile -> onFileReceived -> secondTry -> Retrying to get the file.");

                            fileService.getFileToText(shareName, pFolderPath, pFileName, undefined, onSecondTry);

                            function onSecondTry(err, text, response) {

                                if (err) {
                                    logger.write("[ERROR] getTextFile -> onFileReceived -> secondTry -> File not retrieved. Giving Up.");
                                    callBackFunction(global.DEFAULT_RETRY_RESPONSE);
                                } else {
                                    logger.write("[INFO] getTextFile -> onFileReceived -> secondTry -> File succesfully retrieved on second try.");
                                    callBackFunction(global.DEFAULT_OK_RESPONSE, text);
                                }
                            }
                        }
                    }

                    if (err.code === "ResourceNotFound") {

                        /* This is how Azure tell us the file does not exist. */

                        let customErr = {
                            result: global.CUSTOM_FAIL_RESPONSE.result,
                            message: "File does not exist."
                        };

                        logger.write("[ERROR] getTextFile -> onFileReceived -> Custom Response -> message = " + customErr.message);

                        callBackFunction(customErr);
                        return;

                    }

                    if (err.code === "ParentNotFound") {

                        /* This is how Azure tell us the folder where the file was supposed to be does not exist. We map this to our own response. */

                        let customErr = {
                            result: global.CUSTOM_FAIL_RESPONSE.result,
                            message: "Folder does not exist."
                        };

                        logger.write("[ERROR] getTextFile -> onFileReceived -> Custom Response -> message = " + customErr.message);

                        callBackFunction(customErr);
                        return;

                    }
                    
                    logger.write("[ERROR] getTextFile -> onFileReceived -> Dont know what to do here. Cancelling operation. ");
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);

                } else {
                    if (FULL_LOG === true) { logger.write("[INFO] getTextFile -> onFileReceived -> File retrieved."); }
                    callBackFunction(global.DEFAULT_OK_RESPONSE, text);
                }
            }
        }
        catch (err) {
            logger.write("[ERROR] 'getTextFile' -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function listFilesAndFolders(pFolderPath, callBackFunction) {

        if (fileService === undefined) {

            logger.write("[ERROR] listFilesAndFolders -> initialize function not executed or failed. Can not process this request. Sorry.");
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
            return;
        }

        try {

            let items = {
                files: [],
                folders: []
            };

            /*
            * AZURE HELP:
            *
            * @param { object } [options]                        The request options.
            * @param { int } [options.maxResults]                Specifies the maximum number of folders to return per call to Azure ServiceClient. 
            *                                                    This does NOT affect list size returned by this function. (maximum: 5000)
            * @param { LocationMode } [options.locationMode]     Specifies the location mode used to decide which location the request should be sent to. 
            *                                                    Please see StorageUtilities.LocationMode for the possible values.
            * @param { int } [options.timeoutIntervalInMs]       The server timeout interval, in milliseconds, to use for the request.
            * @param { int } [options.maximumExecutionTimeInMs]  The maximum execution time, in milliseconds, across all potential retries, to use when making this request.
            *                                                    The maximum execution time interval begins at the time that the client begins building the request.The maximum
            *                                                    execution time is checked intermittently while performing requests, and before executing retries.
            * @param { string } [options.clientRequestId]        A string that represents the client request ID with a 1KB character limit.
            * @param { bool } [options.useNagleAlgorithm]        Determines whether the Nagle al
            */

            let options = {
                maxResults: 500
            };

            if (FULL_LOG === true) {
                logger.write("[INFO] listFilesAndFolders -> About to get the list of files and folders.");
                logger.write("[INFO] listFilesAndFolders -> shareName = " + shareName);
                logger.write("[INFO] listFilesAndFolders -> pFolderPath = " + pFolderPath);
            }

            fileService.listFilesAndDirectoriesSegmented(shareName, pFolderPath, null, options, onFilesAndFoldersReceived);

            function onFilesAndFoldersReceived(err, result) {

                try {
                    if (FULL_LOG === true) {
                        logger.write("[INFO] listFilesAndFolders -> onFileReceived -> Response from Azure received.");
                        logger.write("[INFO] listFilesAndFolders -> onFileReceived -> shareName = " + shareName);
                        logger.write("[INFO] listFilesAndFolders -> onFileReceived -> pFolderPath = " + pFolderPath);
                    }

                    if (err) {

                        logger.write("[ERROR] 'listFilesAndFolders' -> onFilesAndFoldersReceived -> err = " + err);
                        callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                        return;

                    } else {

                        items.files.push.apply(items.files, result.entries.files);
                        items.folders.push.apply(items.folders, result.entries.directories);

                        callBackFunction(global.DEFAULT_OK_RESPONSE, items);
                    }
                }
                catch (err) {
                    const logText = "[ERROR] 'listFilesAndFolders - onFilesAndFoldersReceived' - ERROR : " + err.message;
                    logger.write(logText);
                }
            }
        }
        catch (err) {
            logger.write("[ERROR] 'listFilesAndFolders' -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }
};