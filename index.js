/*
 * index.js: Crosstalk Amazon STS API
 *
 * (C) 2012 Crosstalk Systems Inc.
 */
"use strict";

var async = require( 'async' ),
    https = require( 'https' ),
    querystring = require( 'querystring' ),
    xml2js = require( 'xml2js' );

var API_ENDPOINT = "sts.amazonaws.com",
    API_VERSION = "2011-06-15",
    HTTP_VERB = "GET",
    REQUEST_URI = "/";

var getSessionToken = function getSessionToken ( params, callback ) {

  if ( ! callback ) { return; } // nothing to do if no reply requested

  params = params || {};

  //
  // required params
  //
  var awsAccessKeyId = params.awsAccessKeyId,
      secretAccessKey = params.secretAccessKey;

  if ( ! awsAccessKeyId ) return callback( { message : "missing awsAccessKeyId" } );
  if ( ! secretAccessKey ) return callback( { message : "missing secretAccessKey" } );

  //
  // optional params
  //
  var durationSeconds = params.durationSeconds,
      serialNumber = params.serialNumber,
      tokenCode = params.tokenCode;

  var query = {
    //
    // common query params
    //
    Action : "GetSessionToken",
    Version : API_VERSION,
    AWSAccessKeyId : awsAccessKeyId,
    Timestamp : ( new Date() ).toISOString()
  }; 

  //
  // action optional params
  //
  if ( durationSeconds ) query[ 'DurationSeconds' ] = durationSeconds;
  if ( serialNumber ) query[ 'SerialNumber' ] = serialNumber;
  if ( tokenCode ) query[ 'TokenCode' ] = tokenCode;

  //
  // execute the action
  //
  var queryString = querystring.stringify( query );

  async.waterfall([

    // get request signature
    function ( _callback ) {

      crosstalk.emit( '~crosstalk.api.aws.signature.version2', {
        awsAccessKeyId : awsAccessKeyId,
        host : API_ENDPOINT,
        queryString : queryString,
        secretAccessKey : secretAccessKey
      }, '~crosstalk', function ( error, response ) {
        return _callback( error, response );
      }); // crosstalk.emit ~crosstalk.api.aws.signature.version2

    }, // get request signature

    // attach the signature to the request
    function ( response, _callback ) {

      query[ 'Signature' ] = decodeURIComponent( response.signature );
      query[ 'SignatureMethod' ] = response.signatureMethod;
      query[ 'SignatureVersion' ] = response.signatureVersion;

      queryString = querystring.stringify( query );

      return _callback( null, queryString );

    }, // attach the signature to the request

    makeRequest

  ], function ( error, response, body ) {

    if ( error ) {
      return callback( error );
    }

    if ( response.statusCode != 200 ) {
      return callback( body );
    }

    var parser = new xml2js.Parser();

    parser.parseString( body, function ( error, result ) {

      if ( error ) {
        return callback( error );
      }

      if ( ! result || ! result.GetSessionTokenResult 
         || ! result.GetSessionTokenResult.Credentials ) {
        return callback( result );
      }

      return callback( null, {
        credentials : {
          accessKeyId : result.GetSessionTokenResult.Credentials.AccessKeyId,
          secretAccessKey : result.GetSessionTokenResult.Credentials.SecretAccessKey,
          sessionToken : result.GetSessionTokenResult.Credentials.SessionToken
        }
      });

    }); // parser.parseString

  }); // async.waterfall

}; // getSessionToken

var makeRequest = function makeRequest ( queryString, callback ) {

  var requestOptions = {
    host : API_ENDPOINT,
    method : HTTP_VERB,
    path : REQUEST_URI + "?" + queryString
  }

  var req = https.request( requestOptions );

  req.on( 'response', function ( response ) {

    var body = "";

    response.setEncoding( 'utf8' );
    response.on( 'data', function ( chunk ) {
      body += chunk;
    });

    response.on( 'end', function () {
      return callback( null, response, body );
    });

  }); // req.on 'response'

  req.on( 'error', function ( error ) {
    return callback( error );
  });

  req.end();

}; // makeRequest

crosstalk.on( 'api.aws.sts.getSessionToken@v1', 'public', getSessionToken );