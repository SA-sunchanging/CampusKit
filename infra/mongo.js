for (const name of ['review','notification']) {
 db.getSiblingDB(name+'_db').createUser({user:name+'_app',pwd:name+'_demo',roles:[{role:'readWrite',db:name+'_db'}]});
}
