#!/bin/bash

if [[ $CKAN__PLUGINS == *"datapusher"* ]]; then
   # Datapusher settings have been configured in the .env file
   # Set API token if necessary
   if [ -z "$CKAN__DATAPUSHER__API_TOKEN" ] ; then
      echo "Set up ckan.datapusher.api_token in the CKAN config file"
      TOKEN_USER="${CKAN_SYSADMIN_NAME:-${CKAN_BOOTSTRAP_ADMIN_USERNAME:-ckan_admin}}"
      TOKEN_VALUE="$(ckan -c $CKAN_INI user token add "$TOKEN_USER" datapusher | tail -n 1 | tr -d '\t\r\n')"
      if [ -z "$TOKEN_VALUE" ]; then
         echo "Failed to create datapusher token for user '$TOKEN_USER'"
         exit 1
      fi
      ckan config-tool $CKAN_INI "ckan.datapusher.api_token=$TOKEN_VALUE"
   fi
else
   echo "Not configuring DataPusher"
fi
