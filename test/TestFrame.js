/*
 * Test frame
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
