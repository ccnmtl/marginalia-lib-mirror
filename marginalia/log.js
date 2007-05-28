/* 
 * log.js
 *
 * Logging code
 *
 * Marginalia has been developed with funding and support from
 * BC Campus, Simon Fraser University, and the Government of
 * Canada, and units and individuals within those organizations.
 * Many thanks to all of them.  See CREDITS.html for details.
 * Copyright (C) 2005-2007 Geoffrey Glass www.geof.net
 * 
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

/**
 * First argument:  switch on logging
 * Second argument:  log to pop-up log window (not just to console)
 */
function ErrorLogger( on, popup )
{
	this.on = on;
	this.popup = popup;
	this.traceSettings = new Object( );
	return this;
}

ErrorLogger.prototype.getLogElement =  function( )
{
	if ( ! this.logElement )
	{
		this.logWindow = window.open( "", "Log" );
		this.logDocument = this.logWindow.document;
		this.logDocument.open( "text/html", "replace" );
		this.logDocument.write( "<html>\n<head>\n\t<title>Log</title>\n</head>\n<body>\n<ul id='log'>\n</ul>\n</body>\n</html>" );
		this.logDocument.close( );
		this.logElement = this.logDocument.getElementById( 'log' );
	}
	return this.logElement;
}

ErrorLogger.prototype.logError = function( s )
{
	if ( this.on )
	{
		// Only works on Mozilla - other browsers have no dump function
		if ( window.dump )
		{
			// Not working - dunno why.  Or why it has to be so obtuse.
			/*
			netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
			var logger = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
			logger.logStringMessage( s  );
			*/
			dump( "ERROR: " + s + "\n" );
		}
		if ( this.popup )
		{
			var dumpElement = this.getLogElement( );
			if ( dumpElement )
			{
				var li = this.logDocument.createElement( 'li' );
				li.appendChild( this.logDocument.createTextNode( s ) );
				dumpElement.appendChild( li );
			}
		}
	}
}

ErrorLogger.prototype.setTrace = function( topic, b )
{
	this.traceSettings[ topic ] = b;
}

ErrorLogger.prototype.trace = function( topic, s )
{
	if ( this.on && !topic || this.traceSettings[ topic ])
	{
		if ( window.dump )
			dump( s + "\n");
		if ( this.popup )
		{
			var dumpElement = this.getLogElement( );
			if ( dumpElement )
			{
				var li = this.logDocument.createElement( 'li' );
				li.appendChild( this.logDocument.createTextNode( s ) );
				dumpElement.appendChild( li );
			}
		}
	}
}

function logError( s )
{
	if ( window.log )
		window.log.logError( s );
}

function trace( topic, s )
{
	if ( window.log )
		window.log.trace( topic, s );
}

