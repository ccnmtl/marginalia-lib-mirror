/*
 * TestFrame.js
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
 *
 * $Id$
 */

function TestFrame( )
{
	this.tests = new Array();
	this.resultElement = document.getElementById( 'results' );
	this.totalElement = document.getElementById( 'total' );
	return this;
}

TestFrame.prototype.addTest = function( test )
{
	this.tests[ this.tests.length ] = test;
}

TestFrame.prototype.runAllTests = function( )
{
	while ( this.resultElement.firstChild )
		this.resultElement.removeChild( this.resultElement.firstChild );
	while ( this.totalElement.firstChild )
		this.totalElement.removeChild( this.totalElement.firstChild );

	this.passed = 0;
	this.failed = 0;
	for ( var i = 0;  i < this.tests.length;  ++i )
		this.tests[ i ].runTest( this );
	var s = 'Passed ' + this.passed + ', failed ' + this.failed;
	trace( s );
	this.totalElement.appendChild( document.createTextNode( s ) );
}

TestFrame.prototype.fail = function( test, message )
{
	var li = document.createElement( 'li' );
	li.appendChild( document.createTextNode( 'Failed: ' + test.description + ' -> ' + message ) );
	this.resultElement.appendChild( li );
	trace( null, 'Failed:  ' + test.description + ' -> ' + message );
	this.failed += 1;
}

TestFrame.prototype.pass = function( test, message )
{
	var li = document.createElement( 'li' );
	var m = message ? test.description + ' (' + message + ')' : test.description;
	li.appendChild( document.createTextNode( 'Passed: ' + m ) );
	this.resultElement.appendChild( li );
	trace( null, 'Passed:  ' + m );
	this.passed += 1;
}

TestFrame.prototype.passfail = function( test, message, b )
{
	if ( b )
		this.pass( test, message );
	else
		this.fail( test, message );
}
