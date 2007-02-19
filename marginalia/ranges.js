/*
 * range.js
 *
 * Requires domutil.js 
 *
 * Support for different kinds of text range (including the W3C Range object
 * and the TextRange object in IE)
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

/*
 * State values used by state machines
 */
STATE_SPACE = 0
STATE_WORD = 1
STATE_TARGET_SPACE = 2
STATE_TARGET_WORD = 3
STATE_FALL_FORWARD = 4
STATE_DONE = 5

/**
 * OK.  Here's how WordRange and WordPoint work.  Each point (the start and end of the range)
 * is determined from two pieces of information.  The first is the rel element.  
 * This locates a point in the document (the start of the element) after which both
 * the start and end points occur.  The points are specified relative to this rel
 * element in terms of a number of words.  Note, however, that the start and end
 * points don't have to be *within* the rel element - only after its start.
 *
 * The benefits of working this way are twofold:  First, it deals efficiently with
 * points and ranges that exist under the root element but not within a child element.
 * Second, these points can be ordered.
 */
 
/**
 * Convert a text range to a word range
 * This is rather inefficient, because it starts at the beginning of the range for both points.
 * The second point will always follow the first, so with a bit of work the state machine could
 * continue from that point.
 *
 * textRange - the W3C range object (or matching Javascript object) specifying the range
 * root - a root element containing both the start and end points
 * fskip - a function that returns true when an element should not be counted
 * Returns:  A new WordRange object.
 */
function textRangeToWordRange( textRange, root, fskip )
{
	var range = new WordRange( );
	
	rel = closestPrecedingElement( textRange.startContainer );
	range.start = nodePointToWordPoint( textRange.startContainer, textRange.startOffset, rel, true, fskip );

	rel = closestPrecedingElement( textRange.endContainer );
	range.end = nodePointToWordPoint( textRange.endContainer, textRange.endOffset, rel, false, fskip );
	
	// If there was a problem, free memory
	if ( null == range.start || null == range.end )
	{
		if ( range.start )
			range.start.destroy( );
		if ( range.end )
			range.end.destroy( );
		return null;
	}
	
	// Done
	return range;
}

function closestPrecedingElement( rel )
{
	while ( ELEMENT_NODE != rel.nodeType || 'block' != htmlDisplayModel( rel.tagName ))
	{
		if ( rel.previousNode )
			rel = rel.previousElement;
		else if ( rel.parentNode )
			rel = rel.parentNode;
		else
			rel = null;
	}
	return rel;
}


/*
 * Convert a word range to a text range
 * This is also inefficient, because annotation calls it repeatedly, each time from the start
 * of the document.  A better version would take advantage of the fact that highlights are
 * always shown in order.  Also, it suffers from the same inefficiency as textRangeToWordRange.
 */
function wordRangeToTextRange( wordRange, root, fskip )
{
	trace( 'word-range', 'wordRangeToTextRange: ' + wordRange.toString( root ) );

	// Walk to the start point
	var walker = new WordPointWalker( wordRange.start.rel, fskip );
	if ( ! walker.walkToPoint( wordRange.start ) )
	{
		// Using document.documentElement is a slow hack
		trace( 'word-range', 'Unable to find point ' + wordRange.start.toString( root ) );
		return null;
	}
	var startPoint = new NodePoint( walker.currNode, walker.currChars );

	// Walk to the end point
	if ( ! walker.walkToPoint( wordRange.end ) )
	{
		// Using document.documentElement is a slow hack
		trace( 'word-range', 'Unable to find point ' + wordRange.end.toString( root ) );
		return null;
	}
	var endPoint = new NodePoint( walker.currNode, walker.currChars );

	var range = new TextRange( startPoint.container, startPoint.offset, endPoint.container, endPoint.offset );
	walker.destroy( );
	walker = null;
	startPoint.destroy( );
	startPoint = null;
	endPoint.destroy( );
	endPoint = null;
	return range;
}

function TextRange( startContainer, startOffset, endContainer, endOffset )
{
	this.startContainer = startContainer;
	this.startOffset = startOffset;
	this.endContainer = endContainer;
	this.endOffset = endOffset;
	return this;
}

TextRange.prototype.destroy = function( )
{
	this.startContainer = null;
	this.endContainer = null;
}

/*
 * Convert a (container,offset) pair into a word count from containing node named rel
 * container must be the text node containing the point
 * The first representation is browser-specific, but a word count is not.
 * A word is defined as a continuous sequence of non-space characters.  Inline elements
 * are not considered word separators, but block-level elements are.
 * fallBack - if position ends following whitespace, count an extra word?
 */
function nodePointToWordPoint( container, offset, rel, fallForward, fskip )
{
	trace( 'word-range', 'nodePointToWordPoint( ' + container + ',' + offset + ',' + rel + ')' );
	var state = new NodeToWordPoint_Machine( container, offset, rel, fallForward );
	RecurseOnElement( state, rel, fskip );
	var node = rel;
	while ( STATE_DONE != state.state )
	{
		while ( ! node.nextSibling )
			node = node.parentNode;
		if ( null == node )
		{
			state.destroy( );
			return null;
		}
		node = node.nextSibling;
		RecurseOnElement( state, node, fskip )
	}
	var point = state.getPoint( );
	state.destroy( );
	return point;
}

NodeToWordPoint_Machine.prototype.trace = function( input )
{
	trace( 'word-range', 'State ' + this.state + ' at ' + this.words + '.' + this.chars + ' (' + this.offset + ' offset) input "' + input + '"' );
}

function RecurseOnElement( state, node, fskip )
{
	if ( null == node )
		throw( "RecurseOnElement: node is null" );
	if ( ELEMENT_NODE == node.nodeType && ( null == fskip || ! fskip( node ) ) )
	{
		var r = state.startElement( node );
		if ( STATE_DONE == state.state )
			return true;
		if ( r )
		{
			for ( var child = node.firstChild;  null != child;  child = child.nextSibling )
			{
				RecurseOnElement( state, child, fskip )
				if ( STATE_DONE == state.state )
					return true;
			}
			state.endElement( node );
		}
		if ( STATE_DONE == state.state )
			return true;
	}
	else if ( TEXT_NODE == node.nodeType || CDATA_SECTION_NODE == node.nodeType )
	{
		state.text( node );
		if ( STATE_DONE == state.state )
			return true;
	}
	return false;
}


function NodeToWordPoint_Machine( container, offset, rel, fallForward )
{
	this.targetContainer = container;
	this.targetOffset = offset;
	this.fallForward = fallForward;
	this.container = rel;
	this.words = 0;
	this.chars = 0;
	this.state = STATE_SPACE;
	this.offset = 0;
	return this;
}

NodeToWordPoint_Machine.prototype.destroy = function( )
{
	this.targetContainer = null;
	this.container = null;
}


/** Represents a point in the document
 * The point is determined relative to a root, which should be the same for
 * all comparable points.  The position is located by finding a character offset
 * within a word counted relative to the beginning of rel, a block level element.
 */
function WordPoint( )
{
	this.rel = null;
	this.words = 0;
	this.chars = 0;
	return this;
}

WordPoint.prototype.destroy = function( )
{
	delete this.root;
	this.rel = null;
}

/**
 * Compare two points to see which comes first.  The rel elements must be normalized -
 * i.e., each of rel1 and rel2 must be the closest possible rel for p1 and p2
 * respectively.
 */
WordPoint.prototype.compare = function( p2 )
{
	if ( this.rel == p2.rel )
	{
		if ( this.words < p2.words || this.words == p2.words && this.chars < p2.chars )
			return -1;
		else if ( this.words > p2.words || this.words == p2.words && this.chars > p2.chars )
			return 1;
		else
			return 0;
	}
	else
	{
		// Otherwise, compare rel node positions
		// Since these nearly always have precalculated string representations,
		// the easiest way to do this is to compare those.  This is also better
		// than the O(n) liner search to compare positions required by browser that
		// don't support node.compareDocumentPosition.
		// It's a real hack to use document.documentElement here, but it will work (if a bit slowly)
		var p1 = this.toString( document.documentElement );
		var p2 = p2.toString( document.documentElement );
		p1 = p1.split('/');
		p2 = p2.split('/');
		for ( var i = 0;  i < p1.length;  ++i )
		{
			if ( i >= p2.length )
			{
				trace( 'point-compare', 'Compare ' + p1 + ' > ' + p2 );
				return 1;
			}
			var x1 = Number( p1[ i ] );
			var x2 = Number( p2[ i ] );
			if ( x1 < x2 )
			{
				trace( 'point-compare', 'Compare ' + p1 + ' < ' + p2 );
				return -1;
			}
			if ( x1 > x2 )
			{
				trace( 'point-compare', 'Compare ' + p1 + ' > ' + p2 );
				return 1;
			}
		}
		if ( i < p2.length )
		{
			trace( 'point-compare', 'Compare ' + p1 + ' < ' + p2 );
			return -1;
		}
		else
		{
			// this should never happen
			return null;
		}
	}
}

WordPoint.prototype.toString = function( root )
{
	if ( null == root )
		throw "WordPoint.toString requires root parameter";
	if ( ! this.string || this.root != root)
	{
		this.root = root;
		this.string = NodeToPath( root, this.rel ) + '/' + this.words + '.' + this.chars;
	}
	return this.string;
}

WordPoint.prototype.fromString = function( root, s )
{
	var slash = s.lastIndexOf( '/' );
	this.rel = PathToNode( root, s.substring( 0, slash ) );
	var dot = s.indexOf( '.' );
	this.words = s.substring( slash + 1, dot ) * 1;
	this.chars = s.substring( dot + 1 ) * 1;
	//trace( null, 'WordPoint.fromString( ' + root.tagName + ',' + s + ') -> ' + this.rel.tagName + ' + ' + this.words + '.' + this.chars );
	// root and string are cached:
	this.root = root;
	this.string = s;
}

function WordRange()
{
	this.start = null;
	this.end = null;
	return this;
}

WordRange.prototype.destroy = function( )
{
	if ( null != this.start )
		this.start.destroy( );
	if ( null != this.end )
		this.end.destroy( );
}

/** Compare two word ranges
 * -1:  the range starts before r2, or they both start in the same place and it ends earlier
 * 0: the ranges are identical
 * 1: the range starts after r2, or if they both start in the same place it ends later
 */
WordRange.prototype.compare = function( r2 )
{
	a = this.start.compare( r2.start );
	if ( 0 == a )
	{
		b = this.end.compare( r2.end );
		if ( 0 == b )
			return 0;
		else
			return b > 0 ? 1 : -1;
	}
	else
		return a;
}


/**
 * Convert a node relative to a root element to a path.  This is like an xpath
 * except that only element nodes are counted.
 */
function NodeToPath( root, rel )
{
	var path = '';
	var node = rel;
	while ( null != node && root != node )
	{
		var count = 1;
		for ( var prev = node.previousSibling; prev;  prev = prev.previousSibling )
		{
			if ( ELEMENT_NODE == prev.nodeType )
				count += 1;
		}
		path = '/' + String( count ) + path;
		node = node.parentNode;
	}
	return path;
}

/**
 * Convert a path expression (as produced by NodeToPath()) to a node reference
 */
function PathToNode( root, path )
{
	var node;
	path = path.replace( /(\s|\u00a0)+/g, ' ' );
	
	// Locate the rel node based on the path
	// The simple case:  rel is root
	if ( '/' == path )
		node = root;
	// Use XPath support if available (as non-Javascript it should run faster)
	else if ( document.evaluate )
	{
		pathparts = path.split( '/' );
		var xpath = '*[' + Number( pathparts[ 1 ] ) + ']';
		for ( var i = 2;  i < pathparts.length;  ++i )
			xpath += '/*[' + Number( pathparts[ i ] ) + ']';
		var node = document.evaluate( xpath, root, null, XPathResult.ANY_TYPE, null );
		node = node.iterateNext( );
	}
	// Otherwise use my implementation
	else
	{
		node = root;
		nodes = path.split( '/' );
		for ( var i = 1;  i < nodes.length;  ++i )
		{
			var count = Number( nodes[ i ] );
			for ( node = node.firstChild;  null != node;  node = node.nextSibling )
			{
				if ( ELEMENT_NODE == node.nodeType )
				{
					count -= 1;
					if ( 0 == count )
						break;
				}
			}
			if ( 0 != count )
				return null;
		}
	}
	return node;
}

	
/*
 * Convert a word range to a string looking like this:
 * /2/1/3/15.0:/2/1/3/16.4
 * The first portion locates the rel node as the nth block-level element child of its parent.
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
 * because the plus sign and space are hard to read when urlencoded.
 */
WordRange.prototype.toString = function( root )
{
	if ( null == root )
		throw "WordRange.toString() requires root parameter";
	return this.start.toString( root ) + ':' + this.end.toString( root );
}

/** Read in the content of a WordRange from a string.
 *  Assumes the WordRange is set to default values
 *  Returns true if the string format was valid
 *  If the string property is not set by this function, then the input string
 *  did not contain a path component.  This is an indication to the caller to
 *  update the string representation on disk (if that's where it came from).
 */ 
WordRange.prototype.fromString = function( root, s )
{
	var parts = s.split( ':' );
	
	this.start = new WordPoint( );
	this.start.fromString( root, parts[ 0 ] );
	this.end = new WordPoint( );
	this.end.fromString( root, parts[ 1 ] );
}


/** Produce a point based on the state of a NodeToWordPoint_Machine */
NodeToWordPoint_Machine.prototype.getPoint = function( )
{
	var point = new WordPoint( );
	point.rel = this.container;
	point.words = this.words;
	point.chars = this.chars;
	return point;
}

/** Callback when a start or end element is encountered
 * States:  space, word, fall-forward */
NodeToWordPoint_Machine.prototype.startElement = 
NodeToWordPoint_Machine.prototype.endElement = function( node )
{
	this.trace( '<' + node.tagName + '>' );
	if ( 'inline' != htmlDisplayModel( node.tagName ) )
	{
		if ( STATE_WORD == this.state )
			this.state = STATE_SPACE;
		else if ( STATE_FALL_FORWARD == this.state )
		{
			this.state = STATE_DONE;
			return;
		}
	}
	if ( node == this.targetContainer )
	{
		if ( STATE_WORD == this.state )
			this.state == STATE_TARGET_WORD;
		else if ( STATE_SPACE == this.state )
			this.state == STATE_TARGET_SPACE;
	}
	return true;
}

NodeToWordPoint_Machine.prototype.text = function( node )
{
	if ( node == this.targetContainer )
	{
		if ( 0 == this.targetOffset )
		{
			if ( this.fallForward )
			{
				if ( STATE_SPACE == this.state )
				{
					this.words += 1;
					this.chars = 0;
					this.state = STATE_DONE;
					return;
				}
				else
					this.state = STATE_FALL_FORWARD;
			}
			else
			{
				this.state = STATE_DONE;
				return;
			}
		}
		else
		{
			if ( STATE_SPACE == this.state )
				this.state = STATE_TARGET_SPACE;
			else if ( STATE_WORD == this.state )
				this.state = STATE_TARGET_WORD;
		}
		trace( 'word-range', 'In container, state ' + this.state + ' at ' + this.words + '.' + this.chars + ' looking for offset ' + this.targetOffset );
	}
	
	s = node.nodeValue.replace( /(\s|\u00a0)/g, ' ' );
	trace( 'word-range', "Searching in:\n" + s );
	for ( var i = 0;  i < s.length;  ++i )
	{
		var c = s.charAt( i );
		this.trace( c );
		if ( STATE_SPACE == this.state )
		{
			if ( ' ' != c )
			{
				this.chars = 1;
				this.words += 1;
				this.state = STATE_WORD;
			}
		}
		else if ( STATE_WORD == this.state )
		{
			if ( ' ' == c )
				this.state = STATE_SPACE;
			else
			{
				// Don't iterate through every character in the word.  This produces a noticeable
				// speed increase (gut instinct places it at 3-5x).  Also, don't optimize
				// STATE_TARGET_WORD - that's too much complexity for too little benefit. 
				var j = s.indexOf( ' ', i );
				if ( -1 == j )
					this.chars += 1;	// only action required for unoptimized version
				else
				{
					i = j;
					this.chars += j - i;
					this.state = STATE_SPACE;
				}
			}
		}
		else if ( STATE_TARGET_SPACE == this.state )
		{
			if ( ' ' != c )
			{
				this.chars = 1;
				this.words += 1;
				this.state = STATE_TARGET_WORD;
				trace( 'word-range', 'TARGET_SPACE -> TARGET_WORD, offset=' + (this.offset + 1) );
			}
			this.offset += 1;
			if ( this.offset == this.targetOffset )
			{
				if ( this.fallForward )
				{
					if ( this.state == STATE_TARGET_SPACE )
					{
						this.words += 1;
						this.chars = 0;
					}
					else
						this.state = STATE_FALL_FORWARD;
				}
				else
				{
					this.state = STATE_DONE;
					return;
				}
			}
		}
		else if ( STATE_TARGET_WORD == this.state )
		{
			this.offset += 1;
			if ( ' ' == c )
				this.state = STATE_TARGET_SPACE;
			else
				this.chars += 1;
			if ( this.offset == this.targetOffset )
			{
				if ( this.fallForward )
				{
					if ( ' ' == c )
					{
						this.words += 1;
						this.chars = 0;
						this.state = STATE_DONE;
						return;
					}
					else
						this.state = STATE_FALL_FORWARD;
				}
				else
				{
					trace( 'word-range', 'Success at ' + this.words + '.' + this.chars );
					this.state = STATE_DONE;
					return;
				}
			}
		}
		else if ( STATE_FALL_FORWARD == this.state )
		{
			if ( ' ' == c )
			{
				this.words += 1;
				this.chars = 0;
			}
			trace( 'word-range', 'Success: fall forward to ' + this.words + '.' + this.chars );
			this.state = STATE_DONE;
			return;
		}
	}

	// It is possible that this is the target container, but that there's no match yet
	// because we're trying to fall forward.
	// If this is the element and there's no match yet, perhaps fall forward
	if ( node == this.targetContainer && this.fallForward && this.offset == this.targetOffset )
		this.state = STATE_FALL_FORWARD;
	return;
}


/** A NodePoint specifies a point by container and character offset
 * This is the model used by the W3C Range object (e.g. startContainer, startOffset)
 * Note the differences between this and a WordPoint:
 *  - in a NodePoint, container is a text node;  in a WordPoint, it is a block-level element
 *  - in a NodePoint, the offset is contained *within* the container;  in a WordPoint,
 *    the offset follows the start of rel, and may be after the end of the element
 */
function NodePoint( container, offset )
{
	this.container = container;
	this.offset = offset;
	return this;
}

NodePoint.prototype.destroy = function()
{
	this.container = null;
}


/** Convert a word point (rel,word,char) triple to a node point
 */
function wordPointToNodePoint( root, wordPoint, fskip )
{
	var walker = new WordPointWalker( wordPoint.rel, fskip );
	if ( ! walker.walkToPoint( wordPoint ) )
	{
		// Using document.documentElement is a slow hack
		trace( 'word-range', 'Unable to find point ' + wordPoint.toString( document.documentElement ) );
		return null;
	}
	return new NodePoint( walker.currNode, walker.currChars );
}

/** Walk forward, counting words and characters
 * rel - the walk starts at the beginning of this node
 * fskip - function to test nodes that should be ignored in the walk
 */ 
function WordPointWalker( rel, fskip )
{
	this.walker = new DOMWalker( rel );
	// Constant:
	this.fskip = fskip;		// function for skipping over elements
	// Changed only externally:
	this.targetPoint = null;	// the target point to walk to
	// State info:
	this.currNode = rel;	// the current node while walking
	this.currChars = 0;		// (was charOffset) chars inside currNode
	
	this.inTargetRel = false;	// are we after targetPoint.rel been encountered?
	this.inTargetWord = false;	// are we in the word referred to by targetPoint.words?
	this.targetWords = 0;		// total words counted since targetPoint.rel
	this.targetWordChar = 0;	// chars counted inside target word
	
	this.inWord = false;	// is the walker currently in a word?
	this.endTag = false;	// distinguishes start from end tags when element returned
	this.atNodeEnd = false;//true if the walker is at the end of the current text node
	this.eof = false;		// is the walker at document end?
	
	trace ( 'WordPointWalker', 'WordPointWalker INIT' );
	return this;
}

/** Set a destination point for the walk
 * The container for the destination point must be the current node, or it must
 * be ahead in the document. */
WordPointWalker.prototype.setPoint = function( point )
{
	trace( 'WordPointWalker', ' WordPointWalker setTarget(' + point.words + '.' + point.chars + ')' );
	if ( this.currNode == point.rel || this.targetPoint.rel == point.rel )
	{
		this.inTargetRel = true;
		if ( this.targetWords == point.words )
		{
			trace( 'WordPointWalker', ' WordPointWalker - start in target word' );
			this.inTargetWord = true;
		}
		else
		{
		trace( 'WordPointWalker', ' WordPointWalker - start in target node' );
			this.inTargetWord = false;
			this.targetWordChar = 0;
		}
	}
	else
	{
		this.inTargetRel = false;
		this.targetWords = this.targetWordChar = 0;
	}
	// mustn't do this before some of the above tests
	this.targetPoint = point;
}

WordPointWalker.prototype.walkToPoint = function( point )
{
	this.setPoint( point );
	while ( ! this.walk( ) )
		;
	return ! this.eof;
}

/** Get the next block of text.  Returns true if the destination is found.
 *  If the walker passes the end of the document, it returns true and
 *  sets eof to true. */
WordPointWalker.prototype.walk = function()
{
	// Walk to the next node
	while ( true )
	{
		// Only read the next node when ready for it
		if ( this.atNodeEnd )
		{
			if ( this.fskip ? ! this.walker.walk( ! this.fskip( this.walker.node ) )
				: ! this.walker.walk( true ) )
			{
				this.eof = true;
				trace( 'WordPointWalker', ' WordWalker DONE(1)');
				return true;
			}
			this.currNode = this.walker.node;
			this.endTag = this.walker.endTag;
			this.currChars = 0;
			this.atNodeEnd = false;
			if ( this.currNode == this.targetPoint.rel )
			{
				this.inTargetRel = true;
				if ( ! this.walker.endTag )
					this.targetWords = 0;
				// I'm not sure why I had this and can't convince myself it makes sense:
				// this.targetWords = this.inWord ? 1 : 0;
			}
			trace( 'WordPointWalker', ' WordPointWalker in <' + this.currNode.tagName + '>'
				+ ( this.currNode == this.targetPoint.rel && ! this.endTag ? ' (target rel)' : '' ) );
		}
		
			// Only if we're past the target rel should we look inside the text
		if ( this.inTargetRel )
		{
			// All words are in text elements
			if ( TEXT_NODE == this.currNode.nodeType )
			{
				// trace( 'WordPointWalker', ' WordPointWalker - text node' );
				var s = this.currNode.nodeValue.replace( /(\s|\u00a0)/g, ' ' );
				
				// We're currently in a word that has already been counted
				if ( this.inWord )
				{
					// We're in the destination word
					if ( this.inTargetWord )
					{
						// inword remains true even crossing whitespace boundaries now
						
						// See if we can get all the characters we need
						if ( s.length > this.targetPoint.chars - this.targetWordChars )
						{
							this.currChars += this.targetPoint.chars - this.targetWordChars;
							this.targetWordChars = this.targetPoint.chars;
							trace( 'WordPointWalker', ' WordWalker DONE(2) at ' + this.targetWords + '/' + this.currChars );
							return true;
						}
						// If not, get what we can and return
						else
						{
							this.currChars += s.length;
							this.targetWordChars += s.length;
							this.atNodeEnd = true;
							trace( 'WordPointWalker', ' WordWalker node end(3) at ' + this.targetWords + '/' + this.currChars );
							return false;
						}
					}
					// The normal case is to skip the initial non-whitespace sequence
					else
					{
						if ( ' ' != s.charAt( this.currChars ) )
						{
							var spaceOffset = s.indexOf( ' ', this.currChars );
							if ( -1 == spaceOffset )
							{
								// we've hit the end of the current node;  get what we can and return
								this.currChars = s.length;
								this.atNodeEnd = true;
								trace( 'WordPointWalker', ' WordWalker node end(4) at ' + this.targetWords + '/' + this.currChars );
								return false;
							}
							else
								// jump past the current word
								this.currChars = spaceOffset;
						}
						this.inWord = false;
					}
				}
				else
					this.currChars = 0;
				
				// Now iterate over subsequent words
				while ( true )
				{
					// pass over leading whitespace
					while ( ' ' == s.charAt( this.currChars ) && this.currChars < s.length )
						++this.currChars;
					
					// Even if this character offset is the start of a word, it
					// hasn't been counted as such yet.
					this.inWord = false;
					
					// If there's no more in this block of text, return
					if ( s.length == this.currChars )
					{
						this.atNodeEnd = true;
						trace( 'WordPointWalker', ' WordWalker node end(5) at ' + this.targetWords + '/' + this.currChars );
						return false;
					}
					
					// Count this word
					++this.targetWords;
					this.inWord = true;
					
					// Is this the target word?
					if ( this.targetWords == this.targetPoint.words )
					{
						// OK, just grab the characters
						if ( s.length - this.currChars >= this.targetPoint.chars )
						{
							this.targetWordChars = this.targetPoint.chars;
							this.currChars += this.targetPoint.chars;
							trace( 'WordPointWalker', ' WordWalker DONE(6) at ' + this.targetWords + '/' + this.currChars );
							return true;
						}
						// Otherwise keep going to get all those characters
						else
						{
							this.targetWordChars = s.length - this.currChars;
							this.currChars += this.targetWordChars;
							this.inTargetWord = true;
							this.atNodeEnd = true;
							trace( 'WordPointWalker', ' WordWalker node end(7) at ' + this.targetWords + '/' + this.currChars );
							return false;
						}
					}
						
					// Move past this word to the next whitespace sequence
					var wsPos = s.indexOf( ' ', this.currChars );
					
					// If the word isn't here, return s.length
					if ( -1 == wsPos )
					{
						this.inWord = true;
						this.atNodeEnd = true;
						this.currChars = s.length;
						trace( 'WordPointWalker', ' WordPointWalker node end(8) at ' + this.targetWords + '/' + this.currChars );
						return false;
					}
					else
					{
						this.currChars = wsPos;
						this.inWord = false;
					}
				}
			}
			// Words break on block elements
			else if ( ELEMENT_NODE == this.currNode.nodeType )
			{
				//trace( 'WordPointWalker', ' WordPointWalker - element node (' + this.currNode.tagName + ')' );
				// Note that ELEMENT_NODE is returned at both start and end tags
				if ( 'inline' != htmlDisplayModel( this.currNode.tagName ) )
					this.inWord = false;
				this.atNodeEnd = true;
			}
		}
		// Not in the target rel, so move along
		else
		{
			trace( 'WordPointWalker', ' WordPointWalker - still looking for target node' );
			// Haven't encountered the target rel: move along
			this.atNodeEnd = true;
			if ( TEXT_NODE == this.currNode.nodeType )
			{
				var s = this.currNode.nodeValue.replace( /(\s|\u00a0)/g, ' ' );
				this.currChars = s.length;
				trace( 'WordPointWalker', ' WordPointWalker node end(9)' );
				return false;
			}
		}
	}
}

WordPointWalker.prototype.destroy = function()
{
	this.currNode = null;
	this.walker.destroy();
	this.walker = null;
	this.targetPoint = null;	// not owned - don't destroy
}

/**
 * Note that words index from 1, but chars index from zero (!)
 */
function WordOffsetToCharOffset( s, words, chars, inword )
{
	// If inword is true, don't count the first non-whitespace sequence as a word
	if ( inword )
	{
		if ( ' ' != s.charAt( chars ) )
			chars = s.indexOf( ' ', chars );
	}
	
	while ( true )
	{
		// pass over leading whitespace
		while ( ' ' == s.charAt( chars ) && chars < s.length )
			++chars;
		
		// If the word isn't here, return s.length
		if ( s.length == chars )
			return s.length;
		
		// Is this the desired word?
		if ( words == 1 )
			return chars;
		
		// Count this word
		--words;
		
		// Move past this word to the next whitespace sequence
		chars = s.indexOf( ' ', chars );
		
		// If the word isn't here, return s.length
		if ( -1 == chars )
			return s.length;
	}
}



/* ********************
 * W3C Range object and IE text range stuff
 * ********************/

/*
 * Used for converting a (container,offset) pair as used by the W3C Range object
 * to a character offset relative to a specific element.
 */
function getContentOffset( rel, container, offset, fskip )
{
	var sofar = 0;
	
	// Start with rel and walk forward until we hit the range reference
	var node = rel;
	while ( node != container && node != null)
	{
		if ( TEXT_NODE == node.nodeType || CDATA_SECTION_NODE == node.nodeType )
			sofar += node.length;
		node = walkNextNode( node, fskip );
	}
	if ( null == node )
		return 0;

	// First case:  a character offset in a text node (most common case for selection ranges)
	if ( TEXT_NODE == node.nodeType || CDATA_SECTION_NODE == node.nodeType )
	{
		//trace( 'getContentOffset ' + container + ',' + offset + ' -> ' + (sofar+offset) );
		return sofar + offset;
	}
	// Second case:  a child element offset within a non-text node
	else
	{
		// Walk forward through child nodes until we hit the specified offset
		node = node.firstChild;
		for ( var i = 0;  i < offset;  ++i )
		{
			if ( null == node )
				debug( 'Error in getContentOffset:  invalid element offset' );
			sofar += nodeTextLength( node );
			node = node.nextSibling;
		}
		return sofar;
	}
}

function getPortableSelectionRange( )
{
	var range;
	// W3C Range object (Mozilla)
	if ( window.getSelection )
	{
		var selection = window.getSelection( );
		if ( null == selection.rangeCount || 0 == selection.rangeCount )
			return null;
		return selection.getRangeAt( 0 );
	}
	// Internet Explorer
	else if ( document.selection )
	{
		return getSelectionRangeIE( );
		if ( null == range )
			return null;
	}
	// No support
	else
		return null;
}	

/**
 * Get the position and length of a text selection in Internet Explorer
 * returns an object with the following properties:
 * .container
 * .offset
 * .length
 */
function getSelectionRangeIE()
{
	// Return if there's no selection
	if ( document.selection.type == 'None' )
		return null;
	
	// This will be the return value
	var result = new Object();
	
	// Now get the selection and its length.
	// I will try to restrain my frustration.  Because there's a mismatch between the text
	// that IE returns here, and the sequence of text nodes it displays in the DOM tree.
	// If there's a paragraph break, for example, IE will return CR-LF here.  But in the DOM,
	// it will not report any whitespace between the end of one and the start of the other.
	// So, *we can't trust this length*.  Instead, calculate a non-whitespace length and work
	// with *that*.  I will not swear.  I will not swear.  I will not strike microsoft in its
	// big bloody nose with a cluestick the size of manhattan.  Morons.
	var range = document.selection.createRange( );
	var length = range.text.length;
	var nws_length = range.text.replace( /(\s|\u00a0)/g, '' ).length;
	
	// It is necessary to shrink the range so that there are no element
	// boundaries within it.  Otherwise, IE will add missing start and
	// end tags on copy, and add more strange tags on paste, so writing
	// the marker wouldn't be safe.
	range.moveEnd( 'character', 1 - length );

	// Write a marker with a unique ID at the start of the range.
	// A search for this will find the location of the selection.
	var html = range.htmlText;
	range.pasteHTML( '<span id="rangeStart"></span>' + html );
	var markerElement = document.getElementById( 'rangeStart' );
	
	// Find the location of the marker relative to its parent element
	if ( markerElement.previousSibling )
	{
		result.startContainer = markerElement.previousSibling;
		result.startOffset = getContentOffset( result.startContainer, markerElement, 0, null );
	}
	else
	{
		// Special case, because startContainer *must* be a text node.  See below:
		// in this case, after the marker has been deleted the start container must
		// be updated.
		result.startContainer = markerElement.parentNode;
		result.startOffset = 0;
	}
	
	// If the text starts with a space, IE will strip it, so we need to add it back in.
	if ( html.substr( 0, 1 ) == ' ' )
		markerElement.parentNode.insertBefore( document.createTextNode( ' ' ), markerElement );
	// Remove the marker.
	markerElement.parentNode.removeChild( markerElement );
	portableNormalize( markerElement.parentNode );
	
	var walker;
	// Make sure the start marker is a text node.  This may not be the case if there was no node 
	// preceding the marker (see special case above).
	if ( TEXT_NODE != result.startContainer.nodeType )
	{
		walker = new DOMWalker( result.startContainer );
		while ( null != walker.node && TEXT_NODE != walker.node.nodeType )
			walker.walk( ! _skipSmartcopy( walker.node ) );
		result.startContainer = walker.node;
	}
	
	// Convert the length to a container,offset pair as used by W3C
	//var end = walkUntilLen( result.startContainer, result.startOffset + length );
	//result.endContainer = end.container;
	//result.endOffset = end.offset;
	
	// Now we have to count the correct number of non-whitespace characters (see explanation
	// of Microsoft mental disibility above).
	
	var remains = nws_length;
	walker = new DOMWalker( result.startContainer );
	while ( null != walker.node && remains > 0 )
	{
		if ( TEXT_NODE == walker.node.nodeType )
		{
			// So that we only need to compare with spaces later
			var nodeStr = walker.node.nodeValue.replace( /\s/g, ' ' );
			nodeStr = nodeStr.replace( /\u00a0/g, ' ' );
			// Iterate over characters, counting only those that aren't spaces
			var i = ( walker.node == result.startContainer ) ? result.startOffset : 0;
			while ( i < nodeStr.length )
			{
				if ( ' ' != nodeStr.charAt( i ) )
					--remains;
				// If we've counted enough spaces, then this is the end point
				if ( 0 == remains )
				{
					result.endContainer = walker.node;
					result.endOffset = i + 1;
					break;
				}
				++i;
			}
		}
		walker.walk( ! _skipSmartcopy( walker.node ) );
	}
	
	// A full implementation would need to replace the selection here, because
	// adding and removing text clears it.  For annotation, that's not necessary.
	
	return result;
}


/**
 * Create a normalized range, that is, a range consisting of a start and length, both
 * calculated from the same containing element, which is passed in.
 * skipClass - any elements with this class will not be included in the count
 */
function NormalizedRange( range, rel, fskip )
{
	// must ensure that the range starts and ends within the passed rel element
	//if ( ! isElementDescendant( range.startContainer, rel ) || ! isElementDescendant( range.endContainer, rel ) )
	//	return null;

	var nrange = new Object();
	nrange.container = rel;
	nrange.offset = getContentOffset( rel, range.startContainer, range.startOffset, fskip );
	nrange.length = getContentOffset( rel, range.endContainer, range.endOffset, fskip ) - nrange.offset;
	return nrange;
}

/**
 * Get the text inside a TextRange
 * While the built-in toString() method would do this, we need to skip content
 * (such as smart copy text).  This is in fact designed to work with smartcopy, so there
 * are certain cases it may not handle.  This also assumes that the range points to
 * text nodes at the start and end (otherwise walking won't work).
 */
function getTextRangeContent( range, fskip )
{
	var s;
	// Special case
	if ( range.startContainer == range.endContainer )
		s = range.startContainer.nodeValue.substring( range.startOffset, range.endOffset );
	else
	{
		s = range.startContainer.nodeValue.substring( range.startOffset, range.startContainer.length );
		var walker = new DOMWalker( range.startContainer );
		walker.walk( ); // I'm uncertain about the need for this call
		while ( null != walker.node && walker.node != range.endContainer )
		{
			if ( TEXT_NODE == walker.node.nodeType )
				s += walker.node.nodeValue;
			else if ( ELEMENT_NODE == walker.node.nodeType ) //&& 'inline' != htmlDisplayModel( walker.node.tagName ) )
				s += ' ';
			walker.walk( ! fskip( walker.node ) );	
		}
	
		// Pick up content from the last node
		s += range.endContainer.nodeValue.substring( 0, range.endOffset );
		walker.destroy( );
	}
	
	// Normalize spaces
	s = s.replace( /(\s|\u00a0)\s*/g, '$1' );
	s = s.replace( /(\s|\u00a0)$/, '' );
	s = s.replace( /^(\s|\u00a0)/, '' );
	
	return s;
}

/**
 * Get the length of a text range, in characters
 */
function getTextRangeLength( range, fskip )
{
	// We might be pointing to a skipable node to start with.  Move past it.
	var node = range.startContainer;
	if ( fskip( node ) )
		node = walkNextNode( node, fskip );

	var len = 0;
	while ( null != node )
	{
		// grab text if appropriate
		if ( TEXT_NODE == node.nodeType )
		{
			// This case might be broken;  I don't think I've ever tested it.
			if ( node == range.startContainer && node == range.endContainer )
				return range.endOffset - range.startOffset;
			else if ( node == range.startContainer )
				len = node.length - range.startOffset; 
			else if ( node == range.endContainer )
				return len + range.endOffset;
		}
		node = walkNextNode( node, fskip );
			
	}
	return -1;
}

