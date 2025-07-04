"use strict";

require('dotenv').config();

const _ = require("lodash"),
cds = require('@sap/cds'),
tracer = require("tracer"),

logger=tracer.colorConsole({ level: "debug" })
;

module.exports = async (srv) => {
  const { MaterialStock } = srv.entities
  , alreadyAlerted=[]
  , threshold_quantity= process.env.THRESHOLD_QUANTITY;

  srv.on('checkStock', async (req) => {
    return await checkStockAndTriggerTickets();
  });

  async function getAccessToken() {
    const res = await fetch(process.env.ALERT_LOGIN_URL_BASE+'/oauth/token?grant_type=client_credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.ALERT_USER+':'+process.env.ALERT_PASSWORD).toString('base64')
      },
      body: 'grant_type=client_credentials'
    });
    const data = await res.json();
    return data.access_token;
  }
  const access_token=await getAccessToken();

  async function createAlert(items) {
    const notYetAlerted=_.filter(items, item=>!_.find(alreadyAlerted, { ID: item.ID }))

    if(notYetAlerted.length > 0) { 
      logger.debug(`access_token: ${access_token.substring(0,10)}...`)
    
      try {
        const response=await fetch(process.env.ALERT_PUSH_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(
            { 
              "eventType": "LowStockAlert", 
              "eventTimestamp": Math.round(new Date().getTime()/1000), 
              "resource": { "resourceName": "web-shop", "resourceType": "app" }, 
              "severity": "FATAL",
              "category": "ALERT", 
              "subject": `Low stock for ${items.length}`,
              "body": items.map(item=>`ID: ${item.ID}, Material: ${item.material}, quantity: ${item.quantity}`).join(" ")
          })
        });
        logger.debug(`alert result: ${response.statusText} (${response.status})`)
        if(response.ok) {
          alreadyAlerted.push(...notYetAlerted);
        }
      } catch (error) {
        logger.error(`Error sending alert: ${error.message}`);
      }
    } else {
      logger.debug('No new low stock items to alert.')
    }
  }
  

  async function checkStockAndTriggerTickets() {
    const tx = cds.transaction(srv);
    const lowStockItems = await tx.run(
      SELECT.from(MaterialStock).where({ quantity: { '<': threshold_quantity } })
    );
 
    logger.debug(`found ${lowStockItems.length} stock items with quantity<${threshold_quantity}`)
    await createAlert(lowStockItems);
    return lowStockItems
  }
  setInterval(checkStockAndTriggerTickets, 10 * 1000);
};



//comment