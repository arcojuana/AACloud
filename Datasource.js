﻿exports.newDatasource = function newDatasource(BOT, DEBUG_MODULE, FILE_STORAGE, UTILITIES) {

    const FULL_LOG = true;

    /* 

    This module allows trading bots to access information stored at the cloud storage.

    */

    const MODULE_NAME = "Datasource";

    let thisObject = {
        initialize: initialize,
        candlesFiles: new Map,      // Complete sets of candles for different Time Periods. For Time Periods < 1hs sets are of current day only, otherwise whole market.
        candlesMap: new Map,        // The last 10 candles for each Time Period will be stored here.
        stairsFiles: new Map,       // Complete sets of patterns for different Time Periods. For Time Periods < 1hs sets are of current day only, otherwise whole market.
        stairsMap: new Map          // The patterns we are currently in will be stored here.
    };

    let bot = BOT;

    const logger = DEBUG_MODULE.newDebugLog();
    logger.fileName = MODULE_NAME;
    logger.bot = bot;

    let oliviaAzureFileStorage = FILE_STORAGE.newFileStorage(bot);
    let tomAzureFileStorage = FILE_STORAGE.newFileStorage(bot);

    /* Utilities needed. */

    let utilities = UTILITIES.newUtilities(bot);

    return thisObject;

    function initialize(callBackFunction) {

        try {

            if (FULL_LOG === true) { logger.write("[INFO] initialize -> Entering function."); }

            initializeOliviaStorage();

            function initializeOliviaStorage() {

                if (FULL_LOG === true) { logger.write("[INFO] initializeOliviaStorage -> Entering function."); }

                oliviaAzureFileStorage.initialize("AAOlivia", onInizialized);

                function onInizialized(err) {
                    if (err.result === global.DEFAULT_OK_RESPONSE.result) {
                        initializeTomStorage();
                    } else {
                        logger.write("[ERROR] initialize -> initializeOliviaStorage -> err = " + err.message);
                        callBackFunction(err);
                    }
                }
            }

            function initializeTomStorage() {

                if (FULL_LOG === true) { logger.write("[INFO] initializeTomStorage -> Entering function."); }

                tomAzureFileStorage.initialize("AATom", onInizialized);

                function onInizialized(err) {
                    if (err.result === global.DEFAULT_OK_RESPONSE.result) {
                        getCandles(onDone);
                    } else {
                        logger.write("[ERROR] initialize -> initializeTomStorage -> err = " + err.message);
                        callBackFunction(err);
                    }
                }
            }
            
            function onDone(err) {
                try {

                    switch (err.result) {
                        case global.DEFAULT_OK_RESPONSE.result: {
                            logger.write("[INFO] initialize -> onDone -> Execution finished well. :-)");
                            callBackFunction(global.DEFAULT_OK_RESPONSE);
                            return;
                        }
                        case global.DEFAULT_RETRY_RESPONSE.result: {  // Something bad happened, but if we retry in a while it might go through the next time.
                            logger.write("[ERROR] initialize -> onDone -> Retry Later. Requesting Execution Retry.");
                            callBackFunction(err);
                            return;
                        }
                        case global.DEFAULT_FAIL_RESPONSE.result: { // This is an unexpected exception that we do not know how to handle.
                            logger.write("[ERROR] initialize -> onDone -> Operation Failed. Aborting the process.");
                            callBackFunction(err);
                            return;
                        }
                    }

                } catch (err) {
                    logger.write("[ERROR] initialize -> onDone -> err = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getCandles(callBack) {

                try {

                    if (FULL_LOG === true) { logger.write("[INFO] getCandles -> Entering function."); }

                    /*
        
                    We will read several files with candles for the current day. We will use these files as an input
                    to make trading decitions later.
        
                    */

                    getMarketFiles();

                    function getMarketFiles() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] getCandles -> getMarketFiles -> Entering function."); }

                            let filesOk = 0;
                            let filesNotOk = 0;

                            for (i = 0; i < global.marketFilesPeriods.length; i++) {

                                let periodTime = global.marketFilesPeriods[i][0];
                                let periodName = global.marketFilesPeriods[i][1];

                                getFile(oliviaAzureFileStorage, "@AssetA_@AssetB.json", "@Exchange/Output/Candles/Multi-Period-Market/@Period", periodName, undefined, onFileReceived, callBack);

                                function onFileReceived(err, file) {

                                    if (err.result === global.DEFAULT_OK_RESPONSE.result) {
                                        filesOk++;
                                        thisObject.candlesFiles.set(periodName, file);
                                    } else {
                                        filesNotOk++;
                                    }

                                    if (filesOk + filesNotOk === global.marketFilesPeriods.length) {

                                        if (filesOk === global.marketFilesPeriods.length) {

                                            getDailyFiles();

                                        } else {
                                            logger.write("[ERROR] getCandles -> getMarketFiles -> onFileReceived -> Some files are missing -> filesNotOk = " + filesNotOk);
                                            logger.write("[ERROR] getCandles -> getMarketFiles -> onFileReceived -> Will abort the process and request a retry.");
                                            callBack(global.DEFAULT_RETRY_RESPONSE);
                                            return;
                                        }  
                                    }
                                }
                            }
                        } catch (err) {
                            logger.write("[ERROR] getCandles -> getMarketFiles -> err = " + err.message);
                            callBack(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                    function getDailyFiles() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] getCandles -> getDailyFiles -> Entering function."); }

                            let filesOk = 0;
                            let filesNotOk = 0;

                            for (i = 0; i < global.dailyFilePeriods.length; i++) {

                                let periodTime = global.dailyFilePeriods[i][0];
                                let periodName = global.dailyFilePeriods[i][1];

                                getFile(oliviaAzureFileStorage, "@AssetA_@AssetB.json", "@Exchange/Output/Candles/Multi-Period-Daily/@Period/@Year/@Month/@Day", periodName, bot.processDatetime, onFileReceived, callBack);

                                function onFileReceived(err, file) {

                                    if (err.result === global.DEFAULT_OK_RESPONSE.result) {
                                        filesOk++;
                                        thisObject.candlesFiles.set(periodName, file);
                                    } else {
                                        filesNotOk++;
                                    }

                                    if (filesOk + filesNotOk === global.dailyFilePeriods.length) {

                                        if (filesOk === global.dailyFilePeriods.length) {

                                            getCandlesWeAreIn();

                                        } else {
                                            logger.write("[ERROR] getCandles -> getDailyFiles -> onFileReceived -> Some files are missing -> filesNotOk = " + filesNotOk);
                                            logger.write("[ERROR] getCandles -> getDailyFiles -> onFileReceived -> Will abort the process and request a retry.");
                                            callBack(global.DEFAULT_RETRY_RESPONSE);
                                            return;
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            logger.write("[ERROR] getCandles -> getDailyFiles -> err = " + err.message);
                            callBack(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                    function getCandlesWeAreIn() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] getCandles -> getCandlesWeAreIn -> Entering function."); }

                            let counter = 0;

                            thisObject.candlesFiles.forEach(getCurrentCandles);

                            function getCurrentCandles(pCandlesFile, pPeriodName, map) {

                                let candlesArray = [];

                                for (i = 0; i < pCandlesFile.length; i++) {

                                    let candle = {
                                        open: undefined,
                                        close: undefined,
                                        min: 10000000000000,
                                        max: 0,
                                        begin: undefined,
                                        end: undefined,
                                        direction: undefined
                                    };

                                    candle.min = pCandlesFile[i][0];
                                    candle.max = pCandlesFile[i][1];

                                    candle.open = pCandlesFile[i][2];
                                    candle.close = pCandlesFile[i][3];

                                    candle.begin = pCandlesFile[i][4];
                                    candle.end = pCandlesFile[i][5];

                                    if (candle.open > candle.close) { candle.direction = 'down'; }
                                    if (candle.open < candle.close) { candle.direction = 'up'; }
                                    if (candle.open === candle.close) { candle.direction = 'side'; }

                                    /* We are going to store the last 10 candles per period, which will give the bot a good sense of where it is. */

                                    let timePeriod = candle.end - candle.begin + 1; // In miliseconds. (remember each candle spans a period minus one milisecond)

                                    if (candle.begin >= bot.processDatetime.valueOf() - timePeriod * 10 && candle.begin <= bot.processDatetime.valueOf()) {

                                        candlesArray.push(candle);

                                    }
                                }

                                thisObject.candlesMap.set(pPeriodName, candlesArray);

                                counter++;

                                if (counter === thisObject.candlesFiles.size) {

                                    getPatterns(callBack);

                                }
                            }
                        } catch (err) {
                            logger.write("[ERROR] getCandles -> getCandlesWeAreIn -> err = " + err.message);
                            callBack(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write("[ERROR] getCandles -> err = " + err.message);
                    callBack(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getPatterns(callBack) {

                try {

                    if (FULL_LOG === true) { logger.write("[INFO] getPatterns -> Entering function."); }

                    /*
        
                    We will read several files with pattern calculations for the current day. We will use these files as an input
                    to make trading decitions later.
        
                    */

                    getMarketFiles();

                    function getMarketFiles() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] getPatterns -> getMarketFiles -> Entering function."); }

                            let filesOk = 0;
                            let filesNotOk = 0;

                            for (i = 0; i < global.marketFilesPeriods.length; i++) {

                                let periodTime = global.marketFilesPeriods[i][0];
                                let periodName = global.marketFilesPeriods[i][1];

                                getFile(tomAzureFileStorage, "@AssetA_@AssetB.json", "@Exchange/Tom/dataSet.V1/Output/Candle-Stairs/Multi-Period-Market/@Period", periodName, undefined, onFileReceived, callBack);

                                function onFileReceived(err, file) {

                                    if (err.result === global.DEFAULT_OK_RESPONSE.result) {
                                        filesOk++;
                                        thisObject.stairsFiles.set(periodName, file);
                                    } else {
                                        filesNotOk++;
                                    }

                                    if (filesOk + filesNotOk === global.marketFilesPeriods.length) {

                                        if (filesOk === global.marketFilesPeriods.length) {

                                            getDailyFiles();

                                        } else {
                                            logger.write("[ERROR] getPatterns -> getMarketFiles -> onFileReceived -> Some files are missing -> filesNotOk = " + filesNotOk);
                                            logger.write("[ERROR] getPatterns -> getMarketFiles -> onFileReceived -> Will abort the process and request a retry.");
                                            callBack(global.DEFAULT_RETRY_RESPONSE);
                                            return;
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            logger.write("[ERROR] getPatterns -> getMarketFiles -> err = " + err.message);
                            callBack(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                    function getDailyFiles() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] getPatterns -> getDailyFiles -> Entering function."); }

                            let filesOk = 0;
                            let filesNotOk = 0;

                            for (i = 0; i < global.dailyFilePeriods.length; i++) {

                                let periodTime = global.dailyFilePeriods[i][0];
                                let periodName = global.dailyFilePeriods[i][1];

                                getFile(tomAzureFileStorage, "@AssetA_@AssetB.json", "@Exchange/Tom/dataSet.V1/Output/Candle-Stairs/Multi-Period-Daily/@Period/@Year/@Month/@Day", periodName, bot.processDatetime, onFileReceived, callBack);

                                function onFileReceived(err, file) {

                                    if (err.result === global.DEFAULT_OK_RESPONSE.result) {
                                        filesOk++;
                                        thisObject.stairsFiles.set(periodName, file);
                                    } else {
                                        filesNotOk++;
                                    }

                                    if (filesOk + filesNotOk === global.dailyFilePeriods.length) {

                                        if (filesOk === global.dailyFilePeriods.length) {

                                            getStairsWeAreIn();

                                        } else {
                                            logger.write("[ERROR] getPatterns -> getDailyFiles -> onFileReceived -> Some files are missing -> filesNotOk = " + filesNotOk);
                                            logger.write("[ERROR] getPatterns -> getDailyFiles -> onFileReceived -> Will abort the process and request a retry.");
                                            callBack(global.DEFAULT_RETRY_RESPONSE);
                                            return;
                                        }
                                    }
                                }
                            }
                        } catch (err) {
                            logger.write("[ERROR] getPatterns -> getDailyFiles -> err = " + err.message);
                            callBack(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                    function getStairsWeAreIn() {

                        try {

                            if (FULL_LOG === true) { logger.write("[INFO] getPatterns -> getStairsWeAreIn -> Entering function."); }

                            let counter = 0;

                            thisObject.stairsFiles.forEach(getCurrentStairs);

                            function getCurrentStairs(pStairsFile, pPeriodName, map) {

                                for (i = 0; i < pStairsFile.length; i++) {

                                    let stairs = {
                                        open: undefined,
                                        close: undefined,
                                        min: 10000000000000,
                                        max: 0,
                                        begin: undefined,
                                        end: undefined,
                                        direction: undefined,
                                        candleCount: 0,
                                        firstMin: 0,
                                        firstMax: 0,
                                        lastMin: 0,
                                        lastMax: 0
                                    };

                                    stairs.open = pStairsFile[i][0];
                                    stairs.close = pStairsFile[i][1];

                                    stairs.min = pStairsFile[i][2];
                                    stairs.max = pStairsFile[i][3];

                                    stairs.begin = pStairsFile[i][4];
                                    stairs.end = pStairsFile[i][5];

                                    stairs.direction = pStairsFile[i][6];
                                    stairs.candleCount = pStairsFile[i][7];

                                    stairs.firstMin = pStairsFile[i][8];
                                    stairs.firstMax = pStairsFile[i][9];

                                    stairs.lastMin = pStairsFile[i][10];
                                    stairs.lastMax = pStairsFile[i][11];

                                    if (bot.processDatetime.valueOf() >= stairs.begin && bot.processDatetime.valueOf() <= stairs.end) {

                                        thisObject.stairsMap.set(pPeriodName, stairs);

                                    }
                                }

                                counter++;

                                if (counter === thisObject.stairsFiles.size) {

                                    callBack(global.DEFAULT_OK_RESPONSE);

                                }
                            }
                        } catch (err) {
                            logger.write("[ERROR] getPatterns -> getStairsWeAreIn -> err = " + err.message);
                            callBack(global.DEFAULT_FAIL_RESPONSE);
                        }
                    }

                } catch (err) {
                    logger.write("[ERROR] getPatterns -> err = " + err.message);
                    callBack(global.DEFAULT_FAIL_RESPONSE);
                }
            }

            function getFile(pFileStorage, pFileName, pFilePath, pPeriodName, pDatetime, innerCallBack, outerCallBack) {

                try {
                    if (FULL_LOG === true) { logger.write("[INFO] initialize -> getFile -> Entering function."); }
                    if (FULL_LOG === true) { logger.write("[INFO] initialize -> getFile -> pFileName = " + pFileName); }
                    if (FULL_LOG === true) { logger.write("[INFO] initialize -> getFile -> pFilePath = " + pFilePath); }
                    if (FULL_LOG === true) { logger.write("[INFO] initialize -> getFile -> pPeriodName = " + pPeriodName); }
                    if (FULL_LOG === true) { logger.write("[INFO] initialize -> getFile -> pDatetime = " + pDatetime); }

                    pFileName = pFileName.replace("@AssetA", MARKET.assetA);
                    pFileName = pFileName.replace("@AssetB", MARKET.assetB);

                    pFilePath = pFilePath.replace("@Exchange", global.EXCHANGE_NAME);
                    pFilePath = pFilePath.replace("@Period", pPeriodName);

                    if (pDatetime !== undefined) {

                        pFilePath = pFilePath.replace("@Year", pDatetime.getUTCFullYear());
                        pFilePath = pFilePath.replace("@Month", utilities.pad(pDatetime.getUTCMonth() + 1, 2));
                        pFilePath = pFilePath.replace("@Day", utilities.pad(pDatetime.getUTCDate(), 2));

                    }

                    if (FULL_LOG === true) { logger.write("[INFO] initialize -> getFile -> final pFilePath = " + pFilePath); }
                    if (FULL_LOG === true) { logger.write("[INFO] initialize -> getFile -> final pFileName = " + pFileName); }

                    pFileStorage.getTextFile(pFilePath, pFileName, onFileReceived);

                    function onFileReceived(err, text) {

                        if (FULL_LOG === true) { logger.write("[INFO] initialize -> getFile -> onFileReceived -> pFilePath = " + pFilePath); }
                        if (FULL_LOG === true) { logger.write("[INFO] initialize -> getFile -> onFileReceived -> pFileName = " + pFileName); }

                        if (err.result !== global.DEFAULT_OK_RESPONSE.result) {
                            logger.write("[ERROR] initialize -> getFile -> onFileReceived -> err = " + err.message);
                            innerCallBack(err);
                            return;
                        }

                        try {

                            let data = JSON.parse(text);
                            innerCallBack(global.DEFAULT_OK_RESPONSE, data);

                        } catch (err) {
                            logger.write("[ERROR] initialize -> getFile -> onFileReceived -> Parsing JSON -> err = " + err.message);
                            innerCallBack(err);
                            return;
                        }
                    }

                } catch (err) {
                    logger.write("[ERROR] initialize -> getFile -> err = " + err.message);
                    outerCallBack("Operation Failed");
                }
            }

        } catch (err) {

            logger.write("[ERROR] initialize -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }
};