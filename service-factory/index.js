'use strict';
const Seneca = require('seneca');
const logHandler = require('./logHandler');
const logger = require('.local/logger');

const SENECA_TIMEOUT = parseInt(process.env.SENECA_TIMEOUT) || 10000;
const SENECA_LOG_LEVEL = process.env.SENECA_LOG_LEVEL || 'quiet';
const SERVICE_PORT = process.env.SERVICE_PORT || 80;
const SENECA_PROTOCOL = process.env.SENECA_PROTOCOL || 'http';

const SERVICE_NAME_ONE = 'service1';
const SERVICE_NAME_TWO = 'service2';

const isClientTo = (seneca, serviceName) => {
    seneca.client({
        type: SENECA_PROTOCOL,
        host: serviceName,
        port: SERVICE_PORT,
        pin: 'role:' + serviceName,
        timeout: SENECA_TIMEOUT,
    });
};

const isServerAs = (seneca, serviceName) => {
    seneca.listen({
        type: SENECA_PROTOCOL,
        port: SERVICE_PORT,
        pin: 'role:' + serviceName,
    });
};

const addPing = (seneca, serviceName) => {
    seneca.add(`role:${serviceName},cmd:ping`, (args, next) => {
        next({status: 'OK'});
    });
}

module.exports = serviceName => {
    // set options common to all instances
    const service = Seneca({
        transport: {
            //XXX: You MUST set the timeout for 'web' transport too, even if you use TCP.
            //First, Seneca always uses HTTP for its own 'role:internal' messages, regardless
            //of what you choose as your service transport. Second, the property for HTTP
            //in the seneca internal defaults is called 'web', not 'http' as you'd expect.
            'web': {
                timeout: SENECA_TIMEOUT,
            },
            'tcp': {
                timeout: SENECA_TIMEOUT,
            },
        },
        log: SENECA_LOG_LEVEL,
        timeout: SENECA_TIMEOUT,
        internal: {
            logger: logHandler,
        },
    });
    // error handling configuration
    service.fixedargs.fatal$ = false;
    // set up inter-service connection routing
    switch (serviceName) {
        case SERVICE_NAME_ONE:
            isClientTo(service, SERVICE_NAME_TWO);
            break;
        case SERVICE_NAME_TWO:
            isServerAs(service, SERVICE_NAME_TWO);
            break;
        default:
            throw new Error(`Unknown service '${serviceName}'.`);
    }
    // add health endpoints
    addPing(service, serviceName);
    // log env vars right await
    logger.debug('SENECA: Environment variables:', process.env);
    // log when starting successfully
    service.ready(() => {
        logger.info(`SENECA: Service ${serviceName} ready (${SENECA_PROTOCOL} ${SERVICE_PORT} ${SENECA_LOG_LEVEL}).`);
    });

    return service;
};
