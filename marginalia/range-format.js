/*
 * range-format.js
 *
 * Serialization formats for word ranges (see ranges.js).
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

/** BlockRange
 *
 * Range representation represented as word+character offsets relative to a given nested
 * block level element.  Somewhat slow (because nodes must be counted manually to ensure
 * only block-level elements are included), but can be ordered:
 *
 * /2/1/3/15.0;/2/1/3/16.4
 *
 * The first portion locates the rel node as the nth breaking element child of its parent.
 * Non-element nodes are *not counted*;  this is necessary because we don't want to
 * count whitespace only text nodes which might vanish under different formatting.
 * The second part of the string is the starting offset (as word and character),
 * as is the third part.
 *
 * There are usually multiple equivalent locator strings based on different rel
 * nodes.  Normalized paths always use the closest possible rel node - i.e., rel is
 * the element in the document for which the word offsets will be minima.
 * Normalized paths should always be used so that word ranges can be ordered.
 *
 * I experimented with a format looking like /2/1/3+15.0 /2/1/3+16.4, but changed to this
 * because the plus sign and space are hard to read (hence hard to debug) when urlencoded.
 */
function BlockRange( str )
{
	if ( str )
		this.fromString( str );
	return this;
}

BlockRange.prototype.fromString = function( path )
{
	var parts = path.split( ';' );
	if ( parts && 2 == parts.length )
	{
		this.start = new BlockPoint( parts[ 0 ]);
		this.end = new BlockPoint( parts[ 1 ] );
		this.normalized = true;
	}
	else
	{
		// Possibly we have an old block range format with no end block, e.g. /5/2 1.0 1.5
		parts = path.match( /^\s*(\/[\/0-9]*)\s+(\d+)\.(\d+)\s+(\d+)\.(\d+)\s*$/ );
		if ( parts )
		{
			this.start = new BlockPoint( parts[0], parts[1], parts[2] );
			this.end = newBlockPoint( parts[0], parts[3], parts[4] );
			this.normalized = false;
		}
		// We might even have a really ancient word range with no blocks
		// (words count from start of document), e.g. 204.0 204.5
		else
		{
			parts = path.match( /^\s*(\d+)\.(\d+)\s+(\d+)\.(\d+)\s*$/ );
			if ( parts )
			{
				this.start = new BlockPoint( '/', parts[0], parts[1] );
				this.end = new BlockPoint( '/', parts[2], parts[3] );
				this.normalized = false;
			}
			else
				throw "BlockRange parse error";
		}
	}
}

BlockRange.prototype.toString = function( )
{
	return this.start.toString( ) + ';' + this.end.toString( );
}

BlockRange.prototype.compare = function( range2 )
{
	var r = this.start.compare( range2.start );
	if ( 0 != r )
		return r;
	else
		return this.end.compare( range2.end );
}


function BlockPoint( str )
{
	if ( str )
		this.fromString( str );
	return this;
}

BlockPoint.prototype.fromString = function( path, words, chars )
{
	if ( words )
	{
		this.path = path;
		this.words = words;
		this.chars = chars;
	}
	else
	{
		var parts = path.match( /^(.*)\/(\d+)\.(\d+)$/ );
		if ( parts )
		{
			this.path = parts[ 1 ];
			this.words = Number( parts[ 2 ] );
			this.chars = Number( parts[ 3 ] );
		}
		else
		{
			this.path = path;
			this.words = this.chars = 0;
			throw "BlockPoint parse error";
		}
	}
}

BlockPoint.prototype.toString = function( )
{
	if ( this.words )
		return this.path + '/' + this.words + '.' + this.chars;
	else
		return this.path;
}

BlockPoint.prototype.pathFromNode = function( root, rel, fskip )
{
	var node = rel;
	var path = '';
	while ( null != node && root != node )
	{
		var count = 1;
		for ( var prev = node.previousSibling; prev;  prev = prev.previousSibling )
		{
			if ( ! fskip || ! fskip( prev ) )
			{
				if ( ELEMENT_NODE == prev.nodeType && isBreakingElement( prev.tagName ) )
					count += 1;
			}
		}
		path = '/' + String( count ) + path;
		node = node.parentNode;
	}
	this.path = path;
}

/**
 * Find the DOM node corresponding to the path portion of the point
 */
BlockPoint.prototype.getReferenceElement = function( root, fskip )
{
	var node;
	var startTime = new Date( );
	
	// Locate the rel node based on the path
	// The simple case:  rel is root
	if ( '/' == this.path )
		node = root;
	else
	{
		/* This will be slow because it's a linear search.  
		/* It would be well worth optimizing this by caching a list of jump points,
		 * or adding a breaknum attribute usable by xpath (e.g. /*[@breaknum=4]) */
		node = root;
		nodes = this.path.split( '/' );
		for ( var i = 1;  i < nodes.length;  ++i )
		{
			var count = Number( nodes[ i ] );
			for ( node = node.firstChild;  null != node;  node = node.nextSibling )
			{
				if ( fskip && ! fskip( node ) )
				{
					if ( ELEMENT_NODE == node.nodeType && isBreakingElement( node.tagName ) )
					{
						count -= 1;
						if ( 0 == count )
							break;
					}
				}
			}
			if ( 0 != count )
				return null;
		}
	}
	trace( 'range-timing', 'BlockPoint.getReferenceElement timing: ' + ( (new Date()) - startTime ) );

	return node;
}

BlockPoint.prototype.compare = function( point2 )
{
	var p1 = this.path;
	var p2 = point2.path;
	
	if ( p1 == p2 )
	{
		if ( this.words < point2.words || this.words == point2.words && this.chars < point2.chars )
			return -1;
		else if ( this.words > point2.words || this.words == point2.words && this.chars > point2.chars )
			return 1;
		else
			return 0;
	}
	else
	{
		p1 = p1.split('/');
		p2 = p2.split('/');
		for ( var i = 0;  i < p1.length;  ++i )
		{
			if ( i >= p2.length )
			{
				trace( 'BlockPoint.compare', 'Compare ' + p1 + ' > ' + p2 );
				return 1;
			}
			var x1 = Number( p1[ i ] );
			var x2 = Number( p2[ i ] );
			if ( x1 < x2 )
			{
				trace( 'BlockPoint.compare', 'Compare ' + p1 + ' < ' + p2 );
				return -1;
			}
			if ( x1 > x2 )
			{
				trace( 'BlockPoint.compare', 'Compare ' + p1 + ' > ' + p2 );
				return 1;
			}
		}
		if ( i < p2.length )
		{
			trace( 'BlockPoint.compare', 'Compare ' + p1 + ' < ' + p2 );
			return -1;
		}
		else
			throw "Error in BlockPoint.compare";
	}
}


/**
 * XPath representation of a range
 *
 * XPath ranges are fast (assuming the document.evaluate function is implemented in the
 * browser to resolve XPath expressions), but unlike block ranges cannot be ordered.
 */
function XPathRange( str )
{
	if ( str )
		this.fromString( str );
	return this;
}

XPathRange.prototype.fromString = function( path )
{
	var parts = path.split( ';' );
	if ( null == parts || 2 != parts.length )
		throw "XPathRange parse error";
	this.start = new XPathPoint( parts[ 0 ] );
	this.end = new XPathPoint( parts[ 1 ] );
}

XPathRange.prototype.toString = function( )
{
	return this.start.toString( ) + ';' + this.end.toString( );
}


function XPathPoint( str )
{
	if ( str )
		this.fromString( str );
	return this;
}

XPathPoint.prototype.fromString = function( path, words, chars )
{
	if ( words )
	{
		this.path = path;
		this.words = words;
		this.chars = chars;
	}
	else
	{
		var parts = path.match( /^\s*(.*)\/word\((\d+)\)\/char\((\d+)\)\s*$/ );
		if ( parts )
		{
			this.path = parts[ 1 ];
			this.words = Number( parts[ 2 ] );
			this.chars = Number( parts[ 3 ] );
		}
		else
		{
			this.path = path;
			this.words = this.chars = 0;
			throw "XPathPoint parse error";
		}
	}
}

XPathPoint.prototype.toString = function( )
{
	if ( this.words )
		return this.path + '/word(' + this.words + ')/char(' + this.chars + ')';
	else
		return this.path;
}

/**
 * Notice the lack of an fskip function.  None of the parent nodes of the current node
 * can be skippable for this to work.
 */
XPathPoint.prototype.pathFromNode = function( root, rel )
{
	var node = rel;
	var path = '';
	while ( null != node && root != node )
	{
		var count = 1;
		for ( var prev = node.previousSibling; prev;  prev = prev.previousSibling )
		{
			if ( ELEMENT_NODE == prev.nodeType && prev.tagName == node.tagName )
				count += 1;
		}
		if ( '' != path )
			path = '/' + path;
		path = node.tagName.toLowerCase( ) + '[' + String( count ) + ']' + path;
		node = node.parentNode;
	}
	this.path = path;
}

XPathPoint.prototype.getReferenceElement = function( root )
{
	// Use XPath support if available (as non-Javascript it should run faster)
	if ( root.ownerDocument.evaluate )
	{
		var startTime = new Date( );
		// TODO: Figure out how to handle tag case name inconsistencies between HTML and XHTML
		// TODO: add security check here to ensure now unsafe xpath function calls (e.g. document())
		trace( 'xpath-range', 'XPathPoint.getReferenceElement for path ' + this.path );
		var node = root.ownerDocument.evaluate( this.path, root, null, XPathResult.ANY_TYPE, null );
		node = node.iterateNext( );
		trace( 'range-timing', 'XPathPoint.getReferenceElement timing: ' + ( (new Date()) - startTime ) );
		return node;
	}
	else
		throw "No XPath support";
}
