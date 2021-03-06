﻿exports.newExchangeAPI = function newExchangeAPI(BOT, DEBUG_MODULE, POLONIEX_CLIENT_MODULE) {

    const FULL_LOG = true;

    /* 

    This module allows trading bots to connect to the exchange and do trading operations on it. So far it can only work with Poloniex.

    */

    const MODULE_NAME = "Exchange API";

    let thisObject = {
        initialize: initialize,
        getOpenPositions: getOpenPositions,
        getExecutedTrades: getExecutedTrades,
        putPosition: putPosition,
        movePosition: movePosition
    };

    let bot = BOT;

    const logger = DEBUG_MODULE.newDebugLog();
    logger.fileName = MODULE_NAME;
    logger.bot = bot;

    let poloniexApiClient;

    return thisObject;

    function initialize(callBackFunction) {

        try {

            if (FULL_LOG === true) { logger.write("[INFO] initialize -> Entering function."); }

            let apiKey = readApiKey();
            poloniexApiClient = new POLONIEX_CLIENT_MODULE(apiKey.Key, apiKey.Secret);

            callBackFunction(global.DEFAULT_OK_RESPONSE);

            function readApiKey() {

                try {
                    let fs = require('fs');
                    let filePath = '../' + 'API-Keys' + '/' + bot.codeName  + '.'  + global.EXCHANGE_NAME + '.json';
                    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
                }
                catch (err) {
                    logger.write("[ERROR] initialize -> readApiKey -> err = " + err.message);
                    logger.write("[HINT] You need to have a file at this path -> " + filePath);
                    logger.write("[HINT] The file must have the keys to access your poloniex account, in this format -> " + '{ "Key" : "4FB9TMEB-234VH2W1-BYJIXHGM-GL15DSA1", "Secret" : "1a24298skdjdf734uuyhbdagdasdtyut276587256hdsdas765asdasdasd76asdasda765asdasfas6asfda57657asd5a76sd5a7s65d7a6sd57as65d7as65d"}');
                    logger.write("[HINT] You get this key logging in to your Poloniex web account, enabling API keys and getting a new one. ");
                    logger.write("[HINT] Be sure not to allow withdrawls with this Key. When asked at the exchange key page, say no. ");
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

        } catch (err) {

            logger.write("[ERROR] initialize -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function getOpenPositions(pMarket, callBackFunction) {

        try {

            if (FULL_LOG === true) { logger.write("[INFO] getOpenPositions -> Entering function."); }
            if (FULL_LOG === true) { logger.write("[INFO] getOpenPositions -> pMarket = " + JSON.stringify(pMarket)); }

            poloniexApiClient.returnOpenOrders(pMarket.assetA, pMarket.assetB, onExchangeCallReturned);

            function onExchangeCallReturned(err, exchangeResponse) {

                try {

                    if (FULL_LOG === true) { logger.write("[INFO] getOpenPositions -> onExchangeCallReturned -> Entering function."); }
                    if (FULL_LOG === true) { logger.write("[INFO] getOpenPositions -> onExchangeCallReturned -> err = " + err); }
                    if (FULL_LOG === true) { logger.write("[INFO] getOpenPositions -> onExchangeCallReturned -> exchangeResponse = " + JSON.stringify(exchangeResponse)); }

                    poloniexApiClient.analizeResponse(logger, err, exchangeResponse, callBackFunction, onResponseOk);

                    function onResponseOk() {

                        /*

                        This is what we receive from the exchange. We will convert this to our standard format for later use.

                        [ { orderNumber: '151918418632',
                            type: 'sell',
                            rate: '20000.00000000',
                            startingAmount: '0.00010000',
                            amount: '0.00010000',
                            total: '2.00000000',
                            date: '2018-02-24 11:14:17',
                            margin: 0 } ]

                        */

                        let exchangePositions = [];

                        for (let i = 0; i < exchangeResponse.length; i++) {

                            let openPosition = {
                                id: exchangeResponse[i].orderNumber,
                                type: exchangeResponse[i].type,
                                rate: exchangeResponse[i].rate,
                                amountA: exchangeResponse[i].total,
                                amountB: exchangeResponse[i].amount,
                                date: (new Date(exchangeResponse[i].date)).valueOf()
                            };

                            exchangePositions.push(openPosition);
                        }

                        callBackFunction(global.DEFAULT_OK_RESPONSE, exchangePositions);
                    }
                }
                catch (err) {
                    logger.write("[ERROR] getOpenPositions -> onExchangeCallReturned -> Error = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }
        } catch (err) {
            logger.write("[ERROR] getOpenPositions -> Error = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function getExecutedTrades(pPositionId, callBackFunction) {

        try {

            if (FULL_LOG === true) { logger.write("[INFO] getExecutedTrades -> Entering function."); }
            if (FULL_LOG === true) { logger.write("[INFO] getExecutedTrades -> pPositionId = " + pPositionId); }

            poloniexApiClient.returnOrderTrades(pPositionId, onExchangeCallReturned);

            function onExchangeCallReturned(err, exchangeResponse) {

                try {

                    if (FULL_LOG === true) { logger.write("[INFO] getExecutedTrades -> onExchangeCallReturned -> Entering function."); }
                    if (FULL_LOG === true) { logger.write("[INFO] getExecutedTrades -> onExchangeCallReturned -> err = " + err); }
                    if (FULL_LOG === true) { logger.write("[INFO] getExecutedTrades -> onExchangeCallReturned -> exchangeResponse = " + JSON.stringify(exchangeResponse)); }

                    poloniexApiClient.analizeResponse(logger, err, exchangeResponse, callBackFunction, onResponseOk);

                    function onResponseOk() {

                        /*

                          This is what we receive from the exchange. We will convert this to our standard format for later use.

                          [
                          {
                          "globalTradeID": 20825863,
                          "tradeID": 147142,
                          "currencyPair":
                          "BTC_XVC",
                          "type": "buy",
                          "rate": "0.00018500",
                          "amount": "455.34206390",
                          "total": "0.08423828",
                          "fee": "0.00200000",
                          "date": "2016-03-14 01:04:36"
                          },
                          ...]

                          */

                        let trades = [];

                        for (let i = 0; i < exchangeResponse.length; i++) {

                            let trade = {
                                id: exchangeResponse[i].tradeID,
                                type: exchangeResponse[i].type,
                                rate: exchangeResponse[i].rate,
                                amountA: exchangeResponse[i].total,
                                amountB: exchangeResponse[i].amount,
                                fee: exchangeResponse[i].fee,
                                date: (new Date(exchangeResponse[i].date)).valueOf()
                            }

                            trades.push(trade);
                        }

                        callBackFunction(global.DEFAULT_OK_RESPONSE, trades);
                    }
                }
                catch (err) {
                    logger.write("[ERROR] getExecutedTrades -> onExchangeCallReturned -> Error = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }
        } catch (err) {
            logger.write("[ERROR] getExecutedTrades -> Error = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function putPosition(pMarket, pType, pRate, pAmountA, pAmountB, callBackFunction) {

        try {

            if (FULL_LOG === true) { logger.write("[INFO] putPosition -> Entering function."); }
            if (FULL_LOG === true) { logger.write("[INFO] putPosition -> pMarket = " + JSON.stringify(pMarket)); }
            if (FULL_LOG === true) { logger.write("[INFO] putPosition -> pType = " + pType); }
            if (FULL_LOG === true) { logger.write("[INFO] putPosition -> pRate = " + pRate); }
            if (FULL_LOG === true) { logger.write("[INFO] putPosition -> pAmountA = " + pAmountA); }
            if (FULL_LOG === true) { logger.write("[INFO] putPosition -> pAmountB = " + pAmountB); }

            if (pType === "buy") {
                poloniexApiClient.buy(pMarket.assetA, pMarket.assetB, pRate, pAmountB, onExchangeCallReturned);
                return;
            } 

            if (pType === "sell") {
                poloniexApiClient.sell(pMarket.assetA, pMarket.assetB, pRate, pAmountB, onExchangeCallReturned);
                return;
            }

            logger.write("[ERROR] putPosition -> pType must be either 'buy' or 'sell'.");
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
            return;

            function onExchangeCallReturned(err, exchangeResponse) {

                try {

                    if (FULL_LOG === true) { logger.write("[INFO] putPosition -> onExchangeCallReturned -> Entering function."); }
                    if (FULL_LOG === true) { logger.write("[INFO] putPosition -> onExchangeCallReturned -> err = " + err); }
                    if (FULL_LOG === true) { logger.write("[INFO] putPosition -> onExchangeCallReturned -> exchangeResponse = " + JSON.stringify(exchangeResponse)); }

                    poloniexApiClient.analizeResponse(logger, err, exchangeResponse, callBackFunction, onResponseOk);

                    function onResponseOk() {

                        /*

                       This is what we can receive from the exchange.

                       {
                       "orderNumber":31226040,
                       "resultingTrades":
                           [{
                               "amount":"338.8732",
                               "date":"2014-10-18 23:03:21",
                               "rate":"0.00000173",
                               "total":"0.00058625",
                               "tradeID":"16164",
                               "type":"buy"
                           }]
                       }

                       */

                        callBackFunction(global.DEFAULT_OK_RESPONSE, exchangeResponse.orderNumber);
                    }
                }
                catch (err) {
                    logger.write("[ERROR] putPosition -> onExchangeCallReturned -> Error = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

        } catch (err) {
            logger.write("[ERROR] putPosition -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

    function movePosition(pPosition, pNewRate, callBackFunction) {

        try {

            if (FULL_LOG === true) { logger.write("[INFO] movePosition -> Entering function."); }
            if (FULL_LOG === true) { logger.write("[INFO] movePosition -> pPosition = " + JSON.stringify(pPosition)); }
            if (FULL_LOG === true) { logger.write("[INFO] movePosition -> pNewRate = " + pNewRate); }

            poloniexApiClient.moveOrder(pPosition.id, pNewRate, pPosition.amountB, onExchangeCallReturned);

            function onExchangeCallReturned(err, exchangeResponse) {

                if (FULL_LOG === true) { logger.write("[INFO] movePosition -> onExchangeCallReturned -> Entering function."); }
                if (FULL_LOG === true) { logger.write("[INFO] movePosition -> onExchangeCallReturned -> err = " + err); }
                if (FULL_LOG === true) { logger.write("[INFO] movePosition -> onExchangeCallReturned -> exchangeResponse = " + JSON.stringify(exchangeResponse)); }

                try {

                    poloniexApiClient.analizeResponse(logger, err, exchangeResponse, callBackFunction, onResponseOk);

                    function onResponseOk() {

                        if (exchangeResponse.success !== 1) {
                            logger.write("[ERROR] movePosition -> onExchangeCallReturned -> exchangeResponse.success = " + exchangeResponse.success);
                            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                            return;
                        }
                        /*

                       This is what we can receive from the exchange.

                       {
                       "orderNumber":31226040,
                       "resultingTrades":
                           [{
                               "amount":"338.8732",
                               "date":"2014-10-18 23:03:21",
                               "rate":"0.00000173",
                               "total":"0.00058625",
                               "tradeID":"16164",
                               "type":"buy"
                           }]
                       }

                       */

                        callBackFunction(global.DEFAULT_OK_RESPONSE, exchangeResponse.orderNumber);
                    }
                }
                catch (err) {
                    logger.write("[ERROR] movePosition -> onExchangeCallReturned -> Error = " + err.message);
                    callBackFunction(global.DEFAULT_FAIL_RESPONSE);
                }
            }

        } catch (err) {
            logger.write("[ERROR] movePosition -> err = " + err.message);
            callBackFunction(global.DEFAULT_FAIL_RESPONSE);
        }
    }

};