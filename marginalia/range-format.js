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

/** SequenceRange
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
function SequenceRange( str )
{
	if ( str )
		this.fromString( str );
	return this;
}

SequenceRange.prototype.fromString = function( path )
{
	var parts = path.split( ';' );
	if ( parts && 2 == parts.length )
	{
		this.start = new SequencePoint( parts[ 0 ]);
		this.end = new SequencePoint( parts[ 1 ] );
		this.normalized = true;
	}
	else
	{
		// Possibly we have an old sequence range format with no end block, e.g. /5/2 1.0 1.5
		parts = path.match( /^\s*(\/[\/0-9]*)\s+(\d+)\.(\d+)\s+(\d+)\.(\d+)\s*$/ );
		if ( parts )
		{
			this.start = new SequencePoint( parts[0], parts[1], parts[2] );
			this.end = new SequencePoint( parts[0], parts[3], parts[4] );
			this.normalized = false;
		}
		// We might even have a really ancient word range with no blocks
		// (words count from start of document), e.g. 204.0 204.5
		else
		{
			parts = path.match( /^\s*(\d+)\.(\d+)\s+(\d+)\.(\d+)\s*$/ );
			if ( parts )
			{
				this.start = new SequencePoint( '/', parts[0], parts[1] );
				this.end = new SequencePoint( '/', parts[2], parts[3] );
				this.normalized = false;
			}
			else
				throw "SequenceRange parse error";
		}
	}
}

SequenceRange.prototype.toString = function( )
{
	return this.start.toString( ) + ';' + this.end.toString( );
}

SequenceRange.prototype.compare = function( range2 )
{
	var r = this.start.compare( range2.start );
	if ( 0 != r )
		return r;
	else
		return this.end.compare( range2.end );
}

SequenceRange.prototype.equals = function( range2 )
{
	return 0 == this.compare( range2 );
}

// Strip word and character information
SequenceRange.prototype.makeBlockLevel = function( )
{
	this.start.makeBlockLevel( );
	this.end.makeBlockLevel( );
}

function SequencePoint( str )
{
	if ( str )
		this.fromString( str );
	return this;
}

SequencePoint.prototype.fromString = function( path, words, chars )
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
			throw "SequencePoint parse error";
		}
	}
}

SequencePoint.prototype.toString = function( )
{
	if ( this.words )
		return this.path + '/' + this.words + '.' + this.chars;
	else
		return this.path;
}

SequencePoint.prototype.makeBlockLevel = function( )
{
	this.words = None;
	this.chars = None;
}

SequencePoint.prototype.pathFromNode = function( root, rel, fskip )
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
SequencePoint.prototype.getReferenceElement = function( root, fskip )
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

SequencePoint.prototype.compare = function( point2 )
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
				trace( 'SequencePoint.compare', 'Compare ' + p1 + ' > ' + p2 );
				return 1;
			}
			var x1 = Number( p1[ i ] );
			var x2 = Number( p2[ i ] );
			if ( x1 < x2 )
			{
				trace( 'SequencePoint.compare', 'Compare ' + p1 + ' < ' + p2 );
				return -1;
			}
			if ( x1 > x2 )
			{
				trace( 'SequencePoint.compare', 'Compare ' + p1 + ' > ' + p2 );
				return 1;
			}
		}
		if ( i < p2.length )
		{
			trace( 'SequencePoint.compare', 'Compare ' + p1 + ' < ' + p2 );
			return -1;
		}
		else
			throw "Error in SequencePoint.compare";
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

XPathRange.prototype.equals = function( range2 )
{
	return this.start.equals( range2.start ) && this.end.equals( range2.end );
}

XPathRange.prototype.makeBlockLevel = function( )
{
	this.start.makeBlockLevel( )
	this.end.makeBlockLevel( )
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

XPathPoint.prototype.equals = function( point2 )
{
	return this.path == point2.path && this.words == point2.words && this.chars == point2.chars;
}

XPathPoint.prototype.toString = function( )
{
	if ( this.words )
		return this.path + '/word(' + this.words + ')/char(' + this.chars + ')';
	else
		return this.path;
}

XPathPoint.prototype.makeBlockLevel = function( )
{
	this.words = null;
	this.chars = null;
}

/**
 * Notice the lack of an fskip function.  None of the parent nodes of the current node
 * can be skippable for this to work.
 */
XPathPoint.prototype.pathFromNode = function( root, rel, idTest )
{
	var node = rel;
	var path = '';
	var foundId = false;
	outer: while ( null != node && root != node )
	{
		if ( foundId )
		{
			// If we found an ID, short-circuit to produce a path like .//div[@id='id1']/p[5]
			path = './/' + path;
			break;
		}
		else
		{
			// Check whether we can use this node's ID as a start point
			var id = node.getAttribute( 'id', null );
			if ( id && idTest && idTest( id ) && -1 == id.indexOf( "'" ) )
			{
				path = "*[@id='" + id + "']" + ( '' == path ? '' : '/' + path );
				foundId = true;
			}
			else
			{
				var count = 1;
				for ( var prev = node.previousSibling; prev && ! foundId;  prev = prev.previousSibling )
				{
					if ( ELEMENT_NODE == prev.nodeType && prev.tagName == node.tagName )
					{
						id = prev.getAttribute( 'id', null );
						if ( id && idTest && idTest( id ) && -1 == id.indexOf( "'" ) )
							foundId = true;
						else
							count += 1;
					}
				}
				if ( '' != path )
					path = '/' + path;
				
				if ( foundId )
				{
					{
						path = "*[@id='" + id + "']"
							+ '/following-sibling::' + node.tagName.toLowerCase( )
								+ '[' + String( count ) + ']'
							+ path;
						break outer;
					}
				}
				else
				{
					path = node.tagName.toLowerCase( ) + '[' + String( count ) + ']' + path;
					node = node.parentNode;
				}
			}
		}
	}
	this.path = path;
}

/*
 * This doesn't do much checking on the incoming xpath.
 * TODO: Figure out how to handle tag case name inconsistencies between HTML and XHTML
 */
XPathPoint.prototype.getReferenceElement = function( root )
{
	var rel;	// will be the result	
	var xpath = this.path;
	var myroot = root;
	
	var startTime = new Date( );
	trace( 'xpath-range', 'XPathPoint.getReferenceElement for path ' + xpath );

	// Screen out document(), as it is a security risk
	// I would prefer to use a whitelist, but full processing of the xpath
	// expression is expensive and complex.  I'm doing some of this on the
	// server, so unless someone can hijack the returned xpath expressions
	// this should never happen anyway.
	if ( xpath.match( /[^a-zA-Z_]document\s*\(/ ) )
		return null;
	
/*	// Short-circuit paths starting with IDs
	// TODO: Test whether this is or is not faster than the browser XPath
	// evaluation of this kind of path
	var matches = xpath.match( /^\.\/\/\*\[@id\s*=\s*\'([^\']+)\'\](.*)$/ );
	if ( matches )
	{
		myroot = document.getElementById( matches[ 1 ] );
		xpath = matches[ 2 ];
	}
*/	
	// Use XPath support if available (as non-Javascript it should run faster)
	if ( root.ownerDocument.evaluate )
	{
		rel = root.ownerDocument.evaluate( xpath, myroot, null, XPathResult.ANY_TYPE, null );
		rel = rel.iterateNext( );
	}
	// Internet Explorer's xpath support:
	else if ( root.selectSingleNode )
		rel = root.selectSingleNode( xpath );

	trace( 'range-timing', 'XPathPoint.getReferenceElement timing: ' + ( (new Date()) - startTime ) );
		
	// Ensure that the found node is a child of the root
	// This is necessary to reject xpath attempts to get at secure information
	// elsewhere in the page.  It could happen by accident if an ID is used in the xpath,
	// and that ID is used or moved to outside the root.
	if ( ! isElementDescendant( rel, root ) )
		return null;
	
	return rel;
}
