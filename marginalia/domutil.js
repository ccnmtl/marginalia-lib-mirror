/*
 * domutil.js
 *
 * Marginalia has been developed with funding and support from
 * BC Campus, Simon Fraser University, and the Government of
 * Canada, the UNDESA Africa i-Parliaments Action Plan, and  
 * units and individuals within those organizations.  Many 
 * thanks to all of them.  See CREDITS.html for details.
 * Copyright (C) 2005-2007 Geoffrey Glass; the United Nations
 * http://www.geof.net/code/annotation
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

	
// DOM constants
ELEMENT_NODE = 1;
TEXT_NODE = 3;
CDATA_SECTION_NODE = 4;
DOCUMENT_NODE = 9;

domutil = {

instanceOf: function( obj, type )
{
	return type.prototype.isPrototypeOf( obj );
},

/* ******** Display Model Functions ******** */

/*
 * Return the display model (inline, block, none, or unknown) for an HTML element
 * (note that table-row, table-cell, and similar display models are currently treated
 * as 'block')
 */
htmlDisplayModel: function( tagName )
{
	var model = HTML_CONTENT_MODEL[ tagName.toLowerCase() ];
	if ( null != model )
		return model[ 'model' ];
	return 'unknown';
},

/*
 * Determine whether a given HTML element is breaking - i.e., whether the element boundary
 * effectively adds whitespace (inline elements are not breaking;  block, table cell, 
 * and similar elements are)
 */
isBreakingElement: function( tagName )
{
	return 'block' == domutil.htmlDisplayModel( tagName );
},

/*
 * Is an HTML element valid within a specified element?
 * The table used here is generated from the HTML DTD by a Perl script.
 * Not all entities are not fully expanded (although the entity definitions are)
 * This keeps the size of that definition file down, which makes it smaller to download.
 */
isValidHtmlContent: function( parentName, childName )
{
	childName = childName.toLowerCase( );
	var definitions = HTML_CONTENT_MODEL;
	var model = definitions[ parentName.toLowerCase() ];
	if ( null == model )
		return false;
	var content = model.content;
	if ( content[ childName ] )
		return true;
	else
	{
		for ( var child in content )
		{
			if ( child.charAt( 0 ) == '%' && definitions[ child ].content[ childName ] )
				return true;
		}
	}
	return false;
},

/* ******** HTML Class Maniuplation ******** */
/**
 * Test whether a node has a certain class value
 */
hasClass: function( element, className )
{
	if ( null == className )
		return false;
	// Check both className and the class attribute (just in case)
	var classNames;
	if ( element.className )
		classNames = element.className.split( ' ' );
	else if ( element.getAttribute( 'class' ) )
		classNames = element.getAttribute( 'class' ).split( ' ' );
	else
		return false;
	for ( var i = 0;  i < classNames.length;  ++i )
	{
		if ( classNames[ i ] == className )
			return true;
	}
	return false;
},

/**
 * Convenience function to test whether a node matches a tag name and a class name
 * Tag names all converted to lower case before comparison
 */
matchTagClass: function( node, tagName, className )
{
	return ( null == tagName || node.tagName.toUpperCase( ) == tagName.toUpperCase( ) )
		&& ( null == className || domutil.hasClass( node, className ) );
},

/*
 * Remove a class from the set of class names on an element
 */
removeClass: function( element, name )
{
	if ( ! element )
		element.className = element.className;		// dummy line for placing breakpoints
	if ( null == element.className )
		return;
	var classNames = element.className.split( ' ' );
	var newClassNames = "";
	for ( var i = 0;  i < classNames.length;  ++i )
	{
		if ( classNames[ i ] != name )
			newClassNames += ' ' + classNames[ i ];
	}
	if ( newClassNames.charAt( 0 ) == ' ' )
		newClassNames = newClassNames.substring( 1 );
	element.className = newClassNames;
},

/*
 * Add a class from the set of class names on an element (or do nothing if already present)
 */
addClass: function( element, name )
{
	if ( null == element )
		logError( "null element in addClass()" );
	else if ( null == element.className )
		element.className = name;
	else
	{
		var classNames = element.className.split( ' ' );
		var newClassNames = "";
		for ( var i = 0;  i < classNames.length;  ++i )
			if ( classNames[ i ] == name )
				return;
		element.className += ' ' + name;
	}
},

/*
 * Ensure a class value is present/absent
 */
setClass: function( element, name, flag )
{
	if ( flag )
		domutil.addClass( element, name );
	else
		domutil.removeClass( element, name );
},


/* ******** Find DOM Nodes ******** */

/*
 * Fetch the local name for a node (i.e., without any namespace qualifier)
 */
getLocalName: function( element )
{
	if ( element.localName )
		return element.localName;	// W3C implementation
	else
		return element.baseName;	// IE implementation
},

/*
 * I considered cssQuery instead of getChildByTagClass etc., but it has several weaknesses:
 * - in many cases I need to exclude subtrees using fskip
 * - CSS queries only look down the tree, not up or at siblings
 * CSS (or XPath) could be used by filtering out elements that are ancestors of a filtered
 * node.  But then why waste the time scanning what could be a long document?  (Especially when
 * Marginalia already has performance problems).  Better to update cssQuery.
 */

/**
 * Fetch the first child with a given class attribute value
 */
childByTagClass: function( node, tagName, className, fskip )
{
	if ( node == null )
		alert( "node not found tag=" + tagName + ", class=" + className );
	if ( node.nodeType == ELEMENT_NODE && ( ! fskip || ! fskip( node ) ) )
	{
		if ( null == tagName || tagName.toUpperCase( ) == node.tagName.toUpperCase( ) )
		{
			if ( null == className )
				return node;
			var classNames = node.className.split( ' ' );
			for ( var i = 0;  i < classNames.length;  ++i )
			{
				if ( classNames[ i ] == className )
					return node;
			}
		}
		if ( null != node.childNodes )
		{
			for ( var i = 0;  i < node.childNodes.length;  ++i )
			{
				var child = domutil.childByTagClass( node.childNodes[ i ], tagName, className );
				if ( child != null )
					return child;
			}
		}
	}
	return null;
},

/**
 * Get a child anchor (<a>) element by rel value
 */
childAnchor: function( node, relName, fskip )
{
	if ( node == null )
		alert( "node not found tag=" + tagName + " (looking for rel=" + relName + ")");
	if ( node.nodeType == ELEMENT_NODE && ( ! fskip || ! fskip( node ) ) )
	{
		if ( 'A' == node.tagName.toUpperCase() || 'LINK' == node.tagName.toUpperCase() )
		{
			var rel = node.getAttribute( 'rel' );
			if ( null != rel )
			{
				var relNames = rel.split( ' ' );
				for ( var i = 0;  i < relNames.length;  ++i )
				{
					if ( relNames[ i ] == relName )
						return node;
				}
			}
			//trace( null, 'rel=' + node.rel +' , href=' + node.getAttribute( 'rel' ) );
		}
		if ( null != node.childNodes )
		{
			for ( var i = 0;  i < node.childNodes.length;  ++i )
			{
				var child = domutil.childAnchor( node.childNodes[ i ], relName, fskip );
				if ( child != null )
					return child;
			}
		}
	}
	return null;
},

childrenByTagClass: function( node, tagName, className, matches, fskip )
{
	if ( null == matches )
		matches = new Array( );
	if ( node == null )
		alert( "node not found tag=" + tagName + ", class=" + className );
	if ( node.nodeType == ELEMENT_NODE && ( ! fskip || ! fskip( node ) ) )
	{
		if ( null == tagName || tagName.toUpperCase( ) == node.tagName.toUpperCase( ) )
		{
			if ( null == className )
				matches[ matches.length ] = node;
			else if ( null != node.className )
			{
				var classNames = node.className.split( ' ' );
				for ( var i = 0;  i < classNames.length;  ++i )
				{
					if ( classNames[ i ] == className )
						matches[ matches.length ] = node;
				}
			}
		}
		for ( var i = 0;  i < node.childNodes.length;  ++i )
			domutil.childrenByTagClass( node.childNodes[ i ], tagName, className, matches );
	}
	return matches;
},

/*
 * Get the value of a named field in the first ancestor with that field
 */
nestedFieldValue: function( node, field )
{
	while ( null != node && ! node[ field ] )
		node = node.parentNode;
	return null == node ? null : node[ field ];
},

/*
 * Fetch the first parent with a given class attribute value
 * this should be fixed because there can be multiple class names listed in the class attribute
 * The fskip value works a little differently here.  This function guarantees that the result
 * node is not within an element for which fskip is true.
 */
parentByTagClass: function( theNode, tagName, className, topDown, fskip )
{
	var topResult = null;
	var bottomResult = null;
	for ( var node = theNode;  node != null && DOCUMENT_NODE != node.nodeType;  node = node.parentNode )
	{
		if ( fskip && fskip( node ) )
			topResult = bottomResult = null;
		else if ( ELEMENT_NODE == node.nodeType && ( null == tagName || tagName.toUpperCase( ) == node.tagName.toUpperCase( ) ) )
		{
			if ( null == className )
			{
				topResult = node;
				if ( null == bottomResult )
					bottomResult = node;
			}
			else
			{
				var classNames = node.className.split( ' ' );
				for ( var i = 0;  i < classNames.length;  ++i )
				{
					if ( classNames[ i ] == className )
					{
						topResult = node;
						if ( null == bottomResult )
							bottomResult = node;
					}
				}
			}
		}
	}
	return topDown ? topResult : bottomResult;
},

/**
 * Get the next sibling element matchin ga tag and/or class name value
 */
nextByTagClass: function( theNode, tagName, className, fskip )
{
	var prev = null;
	for ( next = theNode.nextSibling;  next;  next = next.nextSibling )
	{
		if ( ! fskip || ! fskip( next ) )
		{
			if ( ELEMENT_NODE == next.nodeType
				&& ( ! tagName || tagName.toLowerCase( ) == next.tagName.toLowerCase( ) )
				&& ( ! className || domutil.hasClass( next, className ) ) )
			{
				break;
			}
		}
	}
	return next;
},

/**
 * Get the previous sibling element matching a tag and/or class name value
 */
prevByTagClass: function( theNode, tagName, className, fskip )
{
	var prev = null;
	for ( prev = theNode.previousSibling;  prev;  prev = prev.previousSibling )
	{
		if ( ! fskip || ! fskip( prev ) )
		{
			if ( ELEMENT_NODE == prev.nodeType
				&& ( ! tagName || tagName.toLowerCase( ) == prev.tagName.toLowerCase( ) )
				&& ( ! className || domutil.hasClass( prev, className ) ) )
			{
				break;
			}
		}
	}
	return prev;
},

/*
 * Check whether a node is a descendant of another node
 */
isElementDescendant: function( element, container )
{
	var parent = element;
	while ( parent != container && null != parent )
		parent = parent.parentNode;
	return parent == null ? false : true;
},

/*
 * Get the first ancestor of the passed node that is a block-level element, or
 * the root element - which ever is lower down the tree.
 */
getBlockParent: function( node, root )
{
	while ( root != node && null != node)
	{
		if ( ELEMENT_NODE == node.nodeType && 'block' == domutil.htmlDisplayModel( node.tagName ) )
			return node;
		node = node.parentNode;
	}
	return root;
},

closestPrecedingElement: function( rel )
{
	while ( ELEMENT_NODE != rel.nodeType || ! domutil.isBreakingElement( rel.tagName ))
	{
		if ( rel.previousNode )
			rel = rel.previousElement;
		else if ( rel.parentNode )
			rel = rel.parentNode;
		else
			rel = null;
	}
	return rel;
},


/* ********** Dom Text Functions ********** */

/*
 * Calculate the number of characters of text in a node
 * Does this work correctly with variable-length unicode characters?
 * Any elements with a class of skipClass are ignored
 */
nodeTextLength: function( node, skipClass )
{
	// Base case
	if ( TEXT_NODE == node.nodeType || CDATA_SECTION_NODE == node.nodeType )
		return node.length;
	// Recurse
	else if ( ELEMENT_NODE == node.nodeType && ( null == skipClass || ! domutil.hasClass( node, skipClass ) ) )
	{
		var n = 0;
		for ( var i = 0;  i < node.childNodes.length;  ++i )
			n += domutil.nodeTextLength( node.childNodes[ i ] );
		return n;
	}
	else
		return 0;
},

/*
 * Uh-oh, there's a problem here:  block-level elements separate words, but
 * inline ones may not (e.g. there may be italics in the middle of a word).
 * Hmmm.
 */
nodeWordCount: function( node, fskip )
{
	// Base case
	if ( TEXT_NODE == node.nodeType || CDATA_SECTION_NODE == node.nodeType )
	{
		// collapse and trim spaces
		var s = node.nodeValue.replace( /\s+/g, ' ' );
		s = s.replace( '^\s+', '' );
		s = s.replace( '\s+$', '' );
		
	}
	// Recurse
	else if ( ELEMENT_NODE == node.nodeType && ( null == fskip || ! fskip( node ) ) )
	{
		var n = 0;
		for ( var child = node.firstChild;  null != child;  child = child.nextSibling )
			n += domutil.nodeWordCount( child );
		return n;
	}
	else
		return 0;
},

/*
 * Return the text contained within a node, with all tags stripped (this is like casting to text in XPath)
 */
getNodeText: function( node )
{
	return node.textContent || node.innerText || domutil._getNodeText( node );
},

_getNodeText: function( node )
{
	if ( node.nodeType == TEXT_NODE || node.nodeType == CDATA_SECTION_NODE )
		return node.nodeValue;
	else if ( node.nodeType == ELEMENT_NODE )
	{
		var s = "";
		for ( var i = 0;  i < node.childNodes.length;  ++i )
			s += domutil._getNodeText( node.childNodes[ i ] );
		return s;
	}
},

/**
 * Normalize a pair of adjacent text nodes - if that's what they are
 * The passed node will not be removed, but the one that follows it might be.
 * Returns the next node after the passed node.
 */
normalizeNodePair: function( firstNode )
{
	if ( firstNode && TEXT_NODE == firstNode.nodeType )
	{
		var nextNode = firstNode.nextSibling;
		if ( nextNode && TEXT_NODE == nextNode.nodeType )
		{
			firstNode.nodeValue += nextNode.nodeValue;
			nextNode.parentNode.removeChild( nextNode );
		}
	}
},

trim:  function( s )
{
	if ( s )
	{
		s = s.replace( /^\s+/, '' );
		s = s.replace( /\s+$/, '' );
	}
	return s;
},

/**
 * Used as an event handler
 */
stopPropagation: function( event )
{
	event.stopPropagation( );
},


/* ********** Form Controls ********** */

/* A list of attributes, used by addFields().  Not comprehensive. */
ELEMENT_ATTRIBUTES:  {
	href: 1,
	title: 1,
	name: 1,
	selected: 1,
	type: 1,
	value: 1
},

EVENTS: {
	change: 1,
	click: 1
},
	
addFields:  function( node, spec )
{
	for ( var field in spec )
	{
		// Add child node (s)
		if ( 'content' == field )
		{
			// Add a text child
			if ( typeof spec[ field ] == 'string' )
				node.appendChild( document.createTextNode( spec[ field ] ) );
			// Add an array of passed node children
			else if ( spec.content.constructor == Array )
			{
				for ( var i = 0;  i < spec.content.length;  ++i )
					node.appendChild( spec.content[ i ] );
			}
			// Add a passed node child
			else
				node.appendChild( spec.content );
		}
//		else if ( 'id' == field )
//			node.id = spec[ field ];
//		else if ( 'className' == field )
//			node.className = spec[ field ];
		// Is this is a known attribute?
		else if ( domutil.ELEMENT_ATTRIBUTES[ field ] )
			node.setAttribute( field, spec[ field ] );
		// Is this an event?  (must be passed starting with "on")
		else if ( 'on' == field.substr( 0, 2 ) && domutil.EVENTS[ field.substr( 2 ) ] )
			addEvent( node, field.substr( 2 ), spec[ field ] );
		// Is this flagged as an attribute (starts with "attr_')
		else if ( 'attr_' == field.substr( 0, 5 ) )
			node.setAttribute( field.substr( 5 ), spec[ field ] );
		// Assume it's a field to set on the object (includes id, className)
		else
			node[ field ] = spec[ field ];
	}
	return node;
},

element: function( name, spec )
{
	var node = document.createElement( name );
	return domutil.addFields( node, spec );
},

button: function( spec )
{
	return domutil.element( 'button', spec );
},


/* ********** Element Position/Dimension Manipulation ********** */

/**
 * Fix the height of an element.  This is necessary for browsers that fail to obey
 * height: 100% correctly (are you listening IE?).
 */
makeFullHeight: function( element )
{
	var height = element.parentNode.offsetHeight;
	element.style.height = element.parentNode.offsetHeight + 'px';
},

/*
 * Return the node offset as a measurement from a parent reference node
 */
getElementYOffset: function( node, parent )
{
	if ( node == null )
		return 0;
	else if ( node.offsetParent == null )
		return domutil.getElementYOffset( node.parentNode, parent );
	else if ( node.offsetParent == parent )
		return node.offsetTop;
	else
		return node.offsetTop + domutil.getElementYOffset( node.offsetParent, parent );
},

getElementXOffset: function( node, parent )
{
	if ( node.offsetParent == parent )
		return node.offsetLeft ;
	else
		return node.offsetLeft + domutil.getElementXOffset( node.offsetParent, parent );
},

/*
 * Get the current window scroll position
 */
getWindowYScroll: function( )
{
	if ( window.pageYOffset )
		return window.pageYOffset;
	else if ( document.documentElement && document.documentElement.scrollTop )
		return document.documentElement.scrollTop;
	else if ( document.body )
		return document.body.scrollTop;
},

getWindowXScroll: function( )
{
	if ( window.pageXOffset )
		return window.pageXOffset;
	else if ( document.documentElement && document.documentElement.scrollLeft )
		return document.documentElement.scrollLeft;
	else if ( document.body )
		return document.body.scrollLeft;
},

scrollWindowToNode: function( node )
{
	if ( null != node )
	{
		var xoffset = domutil.getWindowXScroll( );
		var yoffset = domutil.getElementYOffset( node, node.ownerDocument.documentElement );
		window.scrollTo( xoffset, yoffset );
	}
},


/*
 * Browser independent function to create an XMLHttpRequest ojbect
 */
createAjaxRequest: function( )
{
	if ( window.XMLHttpRequest )
		return new XMLHttpRequest( );  // Gecko / XHTML / WebKit
	else
		return new ActiveXObject( "Microsoft.XMLHTTP" );  // MS IE
},

/*
 * Recursively remove markup tags of a given name and/or class
 * tagName or className can be null to indicate any tag or class
 * Note that this is an HTML implementation:  tag name comparisons are case-insensitive (ack!)
 * Originally written to strip annotation highlights.
 *
 *  node - the node to be recursively stripped
 *  test - call back returns one of 0, STRIP_TAG, or STRIP_CONTENT
 *  doNormalize - if true, normalize this node on completion.  For long documents this can
 *    be *much* faster than normalizing the whole thing
 */
STRIP_NONE: 0,
STRIP_TAG: 1,		// remove the start and end tags, but leave the content in place
STRIP_CONTENT: 2, 	// remove the start and end tags and the content
stripMarkup: function( node, test, doNormalize )
{
	var child = node.firstChild;
	while ( null != child )
	{
		var nextChild = child.nextSibling;
		// only interested in element nodes
		if ( child.nodeType == ELEMENT_NODE )
		{
			var testR = test( child );
			
			// If this and its content are to be stripped, to so immediately - don't bother with children
			if ( domutil.STRIP_CONTENT == testR )
			{
				domutil.clearEventHandlers( child, true );
				var prevNode = child.previousSibling;
				child.parentNode.removeChild( child );
				if ( doNormalize )
				{
					domutil.normalizeNodePair( prevNode );
					nextChild = prevNode.nextSibling;
				}
			}
			// If this is to be unwrapped, first recurse on children
			else if ( domutil.STRIP_TAG == testR )
			{
				domutil.stripMarkup( child, test, doNormalize );
				domutil.unwrapElementChildren( child, doNormalize );
			}
		}
		child = nextChild;
	}
},

/**
 * Remove an element, replacing it with its children
 * Returns the next element following where the element and its children used to be
 * (might not be what's expected if it was normalized away)
 */
unwrapElementChildren: function( node, doNormalize )
{
	var next = node.nextSibling;
	if ( node.firstChild )
	{
		var firstChild = node.firstChild;
		var lastChild = node.lastChild;
		for ( var child = firstChild, nextChild = child.nextSibling;  child;  child = nextChild )
		{
			node.removeChild( child );
			domutil.clearEventHandlers( child, false );
			node.parentNode.insertBefore( child, node );
		}
		node.parentNode.removeChild( node );
		domutil.clearEventHandlers( node, false );
		
		// Normalize by merging first and last children with any adjacent identical text nodes
		if ( doNormalize )
		{
			domutil.normalizeNodePair( lastChild );
			next = lastChild.nextSibling;
			domutil.normalizeNodePair( firstChild.previousSibling );
		}
	}
	return next;
},
	
/*
 * Recursively remove markup tags of a given name and/or class
 * tagName or className can be null to indicate any tag or class
 * Note that this is an HTML implementation:  tag name comparisons are case-insensitive (ack!)
 * Originally written to strip annotation highlights.
 */
stripSubtree: function( node, tagName, className )
{
	var child = node.firstChild;
	while ( child != null )
	{
		var nextChild = child.nextSibling;
		// only interested in element nodes
		if ( child.nodeType == ELEMENT_NODE )
		{
			domutil.stripSubtree( child, tagName, className );
			if ( ( tagName == null || child.tagName.toUpperCase( ) == tagName.toUpperCase( ) )
				&& ( className == null || domutil.hasClass( child, className ) ) )
			{
				domutil.clearEventHandlers( child, true );
				node.removeChild( child );
			}
		}
		child = nextChild;
	}
},
 
/*
 * TODO: Change the name so JSUnit doesn't get confused and think it's a unit test
// Test whether a mouseout event really means the mouse left an element
testMouseLeave: function( e, element )
{
	dump( "leave " );
	if ( ! e )
		var e = window.event;
	var target = (window.event) ? e.srcElement : e.target;
	// if (tg.nodeName != 'DIV') return;
	if ( target != element)
	{
		dump( "target (" + target + ") != element (" + element + ")\n" );
		return false;
	}
	var related = (e.relatedTarget) ? e.relatedTarget : e.toElement;
	while ( related != target && null != related )
		related = related.parentNode;
	dump( related == target ? "related == target\n" : "left\n\n" );
	return related != target;
},
*/

/*
 * Normalize an element and its children
 * This applies the DOM normalize function, which combines adjacent text nodes.
 * It also collapses multiple whitespace characters into a single space.  This
 * is necessary because browsers differ on how they calculate string lengths
 * etc.
 *
 * Also, IE has the absolutely horrifying habit of stripping space characters
 * if they a) are the first characters inside an open tag or b) are the first
 * characters following a closing tag.  In other words, "<span> one </span> two"
 * becomes "<span>one </span>two".  But it doesn't do it all the time;  I haven't
 * yet determined the pattern.  Perhaps there's a standard somewhere that says
 * this is correct display behavior (though if you ask me that doesn't excuse
 * lying about the document).  Collapsing multiple spaces makes good sense in the
 * context of HTML, but trying to handle this look to me a whole lot like data
 * corruption.  So explorer's offsets will differ under some rare circumstances.
 * Exploder, may thy days be numbered and may fire be the eternal rest of thy soul.
 */
normalizeSpace: function( node )
{
	domutil.portableNormalize( node );
	
// Don't do this anymore, for two reasons:  first, it modifies the page content
// unnecessarily; second, Gecko considers nbsp to be a space character, while
// IE does not.
//	normalizeSpaceRecurse( node );
},

normalizeSpaceRecurse: function( node )
{
	for (var i = 0; i < node.childNodes.length; i++ )
	{
		var childNode = node.childNodes[ i ];
		if ( TEXT_NODE == childNode.nodeType )
		{
			childNode.nodeValue = childNode.nodeValue.replace( /(\s)\s+/g, '$1' );
			// See comment at the start of this function about why the following
			// perverted logic has been removed.
			//if ( null == childNode.previousSibling || ELEMENT_NODE == childNode.previousSibling.nodeType )
			//	childNode.nodeValue = childNode.nodeValue.replace( /^\s/, '' );
		}
		if ( ELEMENT_NODE == childNode.nodeType )
			domutil.normalizeSpaceRecurse( childNode )
	}
},

/*
 * An implementation of the W3C DOM normalize function for IE
 * IE often crashes when its implementation is called
 * I'm not going to bother implementing CDATA support
 */
portableNormalize: function( node )
{
	// Internet Explorer often crashes when it tries to normalize
	if ( 'exploder' != domutil.detectBrowser( ) )
		node.normalize( );
	else
	{
		if ( ELEMENT_NODE != node.nodeType )
			return;
		var child = node.firstChild;
		var next;
		while ( null != child )
		{
			if ( ELEMENT_NODE == child.nodeType )
			{
				domutil.portableNormalize( child );
				child = child.nextSibling;
			}
			else if ( TEXT_NODE == child.nodeType )
			{
				if ( '' == child.nodeValue )
				{
					next = child.nextSibling; 
					child.parentNode.removeChild( child );
				}
				else
				{
					next = child.nextSibling;
					var s = '';
					while ( null != next && TEXT_NODE == next.nodeType )
					{
						s += next.nodeValue;
						var t = next.nextSibling;
						child.parentNode.removeChild( next );
						next = t;
					}
					if ( '' != s )
					{
						// this means there was more than one text node in sequence
						child.nodeValue = child.nodeValue + s;
					}
				}
				child = next;
			}
			else
				child = child.nextSibling;
		}
	}
},


/*
 * Browser detects are bad.
 * However, this is needed because IE simply can't handle some things (it crashes)
 * The only value I care about is IE, so this function only returns "opera", "exploder", or "other"
 */
detectBrowser: function( )
{
	var agent = navigator.userAgent.toLowerCase()
	if ( -1 != agent.indexOf( 'opera' ) )  return "opera";  // opera masquerades as ie, so check for it first
	else if ( -1 != agent.indexOf( 'msie' ) )  return "exploder";
	else return "other";
},

/*
 * Return the next node after the current one while walking
 * I'm trying to replace this with the DOMWalker
 */
walkNextNode: function( node, fskip )
{
	var next = node;
	do
	{
		if ( ELEMENT_NODE == next.nodeType && next.firstChild && ( null == fskip || ! fskip( next ) ) )
		{
			trace( 'node-walk', 'walkNextNode (' + node + '=' + node.nodeValue + ') child' );
			next = next.firstChild;
		}
		else if ( next.nextSibling )
		{
			trace( 'node-walk', 'walkNextNode (' + node + '=' + node.nodeValue + ') sibling' );
			next = next.nextSibling;
		}
		else
		{
			trace( 'node-walk', 'walkNextNode (' + node + '=' + node.nodeValue + ') parent' );
			next = next.parentNode;
			while ( null != next && null == next.nextSibling )
				next = next.parentNode;
			if ( null != next )
				next = next.nextSibling;
		}
	}
	while ( null != next && fskip && fskip( next ) );
	trace( 'node-walk', "walkNextNode (" + node + "=" + node.nodeValue + " -> " + next + " (" + next.nodeValue + ")");
	return next;
},

/*
 * Walk r forward until len characters have been passed
 * r.container - the current container element
 * r.offset = the offset within the node to start looking
 */
walkUntilLen: function( node, len )
{
	while ( node != null)
	{
		if ( TEXT_NODE == node.nodeType || CDATA_SECTION_NODE == node.nodeType )
		{
			if ( len <= node.length )
			{
//				var parent = node.parentNode;
				var result = new Object();
				result.container = node; //parent;
				result.offset = len;
				// Now figure out where this is in the context of the parent element
//				for ( var child = parent.firstChild;  child != node;  child = child.nextSibling )
//					result.offset += nodeTextLength( child, null );
				return result;
			}
			else
			{
				len -= node.length;
				node = domutil.walkNextNode( node, null );
			}
		}
		else
			node = domutil.walkNextNode( node, null );
	}
	return null;
},

clearEventHandlers: function( element, recurse, childrenOnly )
{
	if ( ! childrenOnly )
	{
		element.onmousedown = null;
		element.onmouseup = null;
		element.onkeydown = null;
		element.onkeypress = null;
		element.onkeyup = null;
		element.onmouseover = null;
		element.onmouseout = null;
		element.onfocus = null;
		element.onblur = null;
		element.onclick = null;
	}

	if ( recurse )
	{
		for ( var child = element.firstChild;  null != child;  child = child.nextSibling )
		{
			if ( ELEMENT_NODE == child.nodeType )
				domutil.clearEventHandlers( child, true );
		}
	}
},

clearObjectRefs: function( element, fields )
{
	if ( isString( fields ) )
		delete element[ fields ];
	else
	{
		for ( var i = 0;  i < fields.length;  ++i )
			delete element[ fields[ i ] ];
	}
	for ( var child = element.firstChild;  null != child;  child = child.nextSibling )
	{
		if ( ELEMENT_NODE == child.nodeType )
			domutil.clearObjectRefs( child, fields );
	}
},

isString: function( s )
{
	if ( typeof( s ) == 'string' )
		return true;
	else if ( typeof( s ) == 'object' )
		// Based on Kas Thomas's analysis:
		return null != s.constructor.toString( ).match( /string/i );
	else
		return false;
}
};

/**
 * Walk through nodes in document order
 */
function DOMWalker( startNode )
{
	this.node = startNode;
	this.endTag = false;
	this.startTag = true;
}

DOMWalker.prototype.destroy = function( )
{
	this.node = null;
}

WALK_REVERSE = true; /* Pass this to DOMWalker.walk for clarity */

/** Walk through nodes
 * reverse - if true, walk *backwards* instead of forwards
 * I don't know whether it's safe to alternate backward and forward movement with a single walker
 * (I was a bit lax with the startTag/endTag code, which might cause problems)
 */
DOMWalker.prototype.walk = function( gointo, reverse )
{
	if ( ELEMENT_NODE != this.node.nodeType || ! gointo || ( reverse ? this.startTag : this.endTag ) )
	{
		if ( ! reverse && this.node.nextSibling )
		{
			this.node = this.node.nextSibling;
			this.endTag = false;
			this.startTag = true;
		}
		else if ( reverse && this.node.previousSibling )
		{
			this.node = this.node.previousSibling;
			this.startTag = false;
			this.endTag = true;
		}
		else
		{
			this.node = this.node.parentNode;
			this.endTag = ! reverse;
			this.startTag = reverse;
		}
	}
	else if ( reverse ) // ( reverse && ELEMENT_NODE == this.node.nodeType && gointo )
	{
		if ( this.node.lastChild )
			this.node = this.node.lastChild;
		else
		{
			this.startTag = true;
			this.endTag = false;
		}
	}
	else // ( ! reverse && ELEMENT_NODE == this.node.nodeType && gointo )
	{
		if ( this.node.firstChild )
			this.node = this.node.firstChild;
		else
		{
			this.endTag = true;
			this.startTag = false;
		}
	}
	return null == this.node ? false : true;
}

