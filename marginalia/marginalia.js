/*
 * marginalia.js
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

// The names of HTML/CSS classes used by the annotation code.
AN_NOTES_CLASS = 'notes';			// the notes portion of a fragment
AN_HIGHLIGHT_CLASS = 'annotation';// class given to em nodes for highlighting
AN_LINK_CLASS = 'annotation-link';	// class given to a nodes for link annotations
AN_HOVER_CLASS = 'hover';			// assigned to highlights and notes when the mouse is over the other
AN_ANNOTATED_CLASS = 'annotated';	// class added to fragment when annotation is on
AN_SELFANNOTATED_CLASS = 'self-annotated';  // annotations are by the current user (and therefore editable)
AN_DUMMY_CLASS = 'dummy';			// used for dummy item in note list
AN_EDITINGNOTE_CLASS = 'editing-note';		// (on body) indicates a note is being edited
AN_EDITINGLINK_CLASS = 'editing-link';
AN_EDITCHANGED_CLASS = 'changed';	// indicates content of a text edit changed
AN_LASTHIGHLIGHT_CLASS = 'last';	// used to flag the last highlighted regin for a single annotation
AN_QUOTENOTFOUND_CLASS = 'quote-error';	// note's corresponding highlight region not found
AN_NOTECOLLAPSED_CLASS = 'collapsed';		// only the first line of the note shows
AN_ACTIONPREFIX_CLASS = 'action-';		// prefix for class names for actions (e.g. action-delete)

// Classes to identify specific controls
AN_LINKBUTTON_CLASS = 'annotation-link';
AN_ACCESSBUTTON_CLASS = 'annotation-access';
AN_DELETEBUTTON_CLASS = 'annotation-delete';
AN_EXPANDBUTTON_CLASS = 'expand-edit';
AN_KEYWORDSCONTROL_CLASS = 'keywords';

AN_RANGECARET_ID = 'range-caret';		// identifies caret used to show zero-length ranges

AN_ANNOTATION_FIELD = 'annotation';	// reference to Annotation object
AN_POST_FIELD = 'post';				// reference to PostMicro object

AN_ID_PREFIX = 'annot';				// prefix for annotation IDs in element classes and IDs
AN_SUN_SYMBOL = '\u25cb'; //'\u263c';
AN_MOON_SYMBOL = '\u25c6'; //'\u2641';
AN_LINK_ICON = '\u263c'; //'\u238b'; circle-arrow // \u2318 (point of interest) \u2020 (dagger) \u203b (reference mark) \u238b (circle arrow)
AN_LINK_EDIT_ICON = '\u263c'; //'\u238b'; circle-arrow// \u2021 (double dagger)
AN_COLLAPSED_ICON = '+'; // '\u25b7'; triangle
AN_EXPANDED_ICON = '-'; // '\u25bd';
AN_LINKEDIT_LABEL = '\u263c'; // '\u238b'; circle-arrow

// Length limits
MAX_QUOTE_LENGTH = 1000;
MAX_NOTE_LENGTH = 250;
MAX_NOTEHOVER_LENGTH = 24;
MAX_LINK_LENGTH = 255;

// The timeout between coop multitasking calls.  Should be short so most time is spent doing
// something rather than timing out.
AN_COOP_TIMEOUT = 10;

// The maximum time to spend on one coop multitasking call.  Should be short enough to be
// fairly unnoticeable, but long enough to get some work done.
AN_COOP_MAXTIME = 240;

/* ************************ User Functions ************************ */

/**
 * Must be called before any other annotation functions
 * service - used to connect to the server side
 * anuser - the user whose annotations are to be shown
 * thisuser - the current user (may differ from anuser)
 * urlBase - if null, annotation URLs are used as normal.  Otherwise, they are searched for this
 * string and anything preceeding it is chopped off.  This is necessary because IE lies about
 * hrefs:  it provides an absolute URL for that attribute, rather than the actual text.  In some
 * cases, absolute URLs aren't desirable (e.g. because the annotated resources might be moved
 * to another host, in which case the URLs would all break).
 */
function marginaliaInit( service, thisuser, anuser, urlBase, preferences, keywordService )
{
	window.marginalia = new Marginalia( service, thisuser, anuser, urlBase, preferences, keywordService );

	// Event handlers
	if ( document.addEventListener )
	{
		document.addEventListener( 'keyup', _keyupCreateAnnotation, false );
		// TODO: These display where the user clicks in a document.
		// There's no support for this UI nicety in IE.
		/* commented out for now - see comments in _mouseupShowCaret
		document.addEventListener( 'mousedown', _mousedownHideCaret, false );
		document.addEventListener( 'mouseup', _mouseupShowCaret, false );
		*/
	}
	else  // for IE:
	{
		if ( document.onkeyup )
			document.onkeyup = function( event ) { _keyupCreateAnnotation(event); document.onkeyup; }
		else
			document.onkeyup = _keyupCreateAnnotation;
	}
	
	// Click-to-link doesn't work in IE because of its weak event model
	if ( ANNOTATION_LINKING && window.addEventListener )
	{
		window.addEventListener( 'focus', _enableLinkTargets, false );
		window.addEventListener( 'focus', _updateLinks, false );
	}
}


function Marginalia( service, username, anusername, urlBase, preferences, keywordService )
{
	this.urlBase = urlBase;
	this.annotationService = service;
	this.username = username;
	this.anusername = anusername;
	this.preferences = preferences;
	this.keywordService = keywordService;
	return this;
}

/**
 * Could do this in the initializer, but by leaving it until now we can avoid
 * forcing clients to have an onload handler
 */
Marginalia.prototype.listPosts = function( )
{
	if ( ! this.posts )
		this.posts = new PostPageInfo( document );
	return this.posts;
}

Marginalia.prototype.createAnnotation = function( annotation, f )
{
	this.annotationService.createAnnotation( annotation, f );
}

Marginalia.prototype.updateAnnotation = function( annotation )
{
	// Before storing the annotation, check whether it's using a denormalized block range.
	// If it is, recalculate the block range and store the new (faster) format.
	var blockRange = annotation.getRange( BLOCK_RANGE );
	if ( blockRange && ! blockRange.normalized )
	{
		var post = this.listPosts( ).getPostByUrl( annotation.getUrl() );
		if ( post )
		{
			var root = post.getContentElement( );
			var wordRange = new WordRange( );
			wordRange.fromBlockRange( blockRange, root, _skipContent );
			annotation.setRange( BLOCK_RANGE, wordRange.toBlockRange( root ) );
		}
	}
	if ( annotation.hasChanged() )
	{
		var f = function( )
		{
			annotation.resetChanges();
		}
		this.annotationService.updateAnnotation( annotation, f );
	}
}

Marginalia.prototype.deleteAnnotation = function( annotationId )
{
	this.annotationService.deleteAnnotation( annotationId, null );
}


/**
 * Show Marginalia features on the page
 * triggers some CSS classes which can be used to show/hide the annotation margin etc.
 */
Marginalia.prototype.showMarginalia = function( )
{
	var bodyElement = document.getElementsByTagName( 'body' )[ 0 ];
	addClass( bodyElement, AN_ANNOTATED_CLASS );
	if ( this.username == this.anusername )
		addClass( bodyElement, AN_SELFANNOTATED_CLASS );
}


/**
 * Hide Marginalia features on a page
 * This used to be part of hideAllAnnotations, but because it is sometimes necessary
 * to hide the annotations while allowing users to retrieve subsets of them, this
 * function was necessary (along with showMarginalia).
 */
Marginalia.prototype.hideMarginalia = function( )
{
	var bodyElement = document.getElementsByTagName( 'body' )[ 0 ];
	removeClass( bodyElement, AN_ANNOTATED_CLASS );
	removeClass( bodyElement, AN_SELFANNOTATED_CLASS );
}	


/**
 * Show all annotations on the page
 * Make sure to call showMarginalia too
 * There used to be showAnnotations and hideAnnotations functions which could
 * apply to individual posts on a page.  Unused, I removed them - they added
 * complexity because annotations needed to be stored but not displayed.  IMHO,
 * the best way to do this is with simple dynamic CSS (using display:none).
 */
Marginalia.prototype.showAnnotations = function( url, block )
{
	this.annotationService.listAnnotations( url, this.anusername, block, _showAnnotationsCallback );
	// This used to be done by the callback function, but doing it here has the benefit
	// of getting it done while the server is busy fetching the result.
	this.hideAnnotations( );
}

Marginalia.prototype.showBlockAnnotations = function( url, block )
{
	// TODO: Push down calculations must be repaired where new annotations are added.
	// Ideally this would happen automatically.
	this.annotationService.listAnnotations( url, null, block, _showAnnotationsCallback );
}

/**
 * This is the callback function called by listAnnotations when data first comes back
 * from the server.
 */
function _showAnnotationsCallback( xmldoc )
{
	// Existing annotations used to be stripped here.  I moved that to listAnnotations
	// to take advantage of server processing time.
	window.marginalia.annotationXmlCache = xmldoc;
	_annotationDisplayCallback( );
}

/**
 * This callback is used to display annotations from the cache in the marginalia object.
 * It will spend a certain amount of time displaying annotations;  if it can't show them
 * all in that time, it will call setTimeout to trigger continued display later.  This
 * is basically a way to implement cooperative multitasking so that if many annotations
 * need to be displayed the browser won't lock up.
 */
function _annotationDisplayCallback( )
{
	var startTime = new Date( );
	var curTime;
	var marginalia = window.marginalia;
	
	// Parse the XML, if that hasn't been done already
	if ( marginalia.annotationXmlCache )
	{
		marginalia.annotationCache = parseAnnotationXml( marginalia.annotationXmlCache );
		delete marginalia.annotationXmlCache;
		curTime = new Date( );
		if ( curTime - startTime >= AN_COOP_MAXTIME )
		{
			setTimeout( _annotationDisplayCallback, AN_COOP_TIMEOUT );
			return;
		}
	}
	
	// Display cached annotations
	// Do this by merging the new annotations with those already displayed
	// For this to work, annotations must be sorted by URL
	var annotations = marginalia.annotationCache;
	if ( annotations )
	{
		var url = null;			// there may be annotations for multiple URLs;  this is the current one
		var post = null;		// post for the current url
		var notes = null;		// current notes element
		var nextNode = null;
		for ( var annotation_i = 0;  annotation_i < annotations.length;  ++annotation_i )
		{
			// Don't want to fail completely just because one or more annotations are malformed
			if ( null != annotations[ annotation_i ] )
			{
				var annotation = annotations[ annotation_i ];
				
				// Determine whether we're moving on to a new post (hence a new note list)
				if ( annotation.getUrl( ) != url )
				{
					url = annotation.getUrl( );
					post = marginalia.listPosts( ).getPostByUrl( url );
					// Find the first note in the list (if there is one)
					notes = post.getNotesElement( );
					nextNode = notes.firstCild;
				}
				
				// Find the position of the annotation by walking through the note list
				// (binary search would be nice here, but not practical unless the list is
				// stored somewhere other than in the DOM - plus, since multiple annotations
				// are dealt with here at once, the speed hit shouldn't be too bad)
				while ( nextNode )
				{
					if ( ELEMENT_NODE == nextNode.nodeType && nextNode.annotation )
					{
						if ( annotation.compareRange( nextNode.annotation ) < 0 )
							break;
					}
					nextNode = nextNode.nextSibling;
				}
				
				// Now insert before beforeNote
				post.addAnnotation( marginalia, annotation, nextNode );
			}
			
			annotations[ annotation_i ] = null;
			if ( curTime - startTime >= AN_COOP_MAXTIME )
				break;
		}
		
/* 		for ( i = 0;  i < annotations.length;  ++i )
		{
			if ( null != annotations[ i ] )
			{
				var post = marginalia.listPosts( ).getPostByUrl( annotations[ i ].getUrl() );
				// TODO: To allow multiple fetches to merge annotations into the display
				// (e.g. when the user grabs notes for a paragraph), calculate the position
				// using a binary search:
				var pos = i;
				if ( -1 == post.addAnnotationPos( marginalia, annotations[ i ], pos ) )
				{
					// Formerly displayed an error on the post saying one or more annotations
					// could not be placed.  Now annotations are shown, but without highlights
					// and with an error for each instead.
					;
				}
				// I figure it's probably cheaper to null them rather than resizing the array
				// each time
				annotations[ i ] = null;
				
				curTime = new Date( );
				if ( curTime - startTime >= AN_COOP_MAXTIME )
					break;
			}
		}
*/		
		if ( annotations.length == annotation_i )
			delete marginalia.annotationCache;
		else
			setTimeout( _annotationDisplayCallback, AN_COOP_TIMEOUT );
	}
}

/**
 * Hide all annotations on the page
 */
Marginalia.prototype.hideAnnotations = function( )
{
	var posts = this.listPosts( ).getAllPosts( );
	for ( var i = 0;  i < posts.length;  ++i )
	{
		var post = posts[ i ];
		// Should also destruct each annotation
		var annotations = post.removeAnnotations( marginalia );
		for ( var j = 0;  j < annotations.length;  ++j )
			annotations[ j ].destruct( );
		// normalizeSpace( post.element );
	}
}

/**
 * Show Per-Block User Counts
 */
Marginalia.prototype.showPerBlockUserCounts = function( url )
{
	this.annotationService.listPerBlockUsers( url, _showPerBlockUserCountsCallback );
}

function _showPerBlockUserCountsCallback( xmldoc )
{
	var userCounts = parseBlockUserCountsXml( xmldoc );
	for ( var i = 0;  i < userCounts.length;  ++i )
	{
		var userCount = userCounts[ i ];
		var post = window.marginalia.listPosts( ).getPostByUrl( userCount.url );
		post.showPerBlockUserCount( marginalia, userCount );
	}
}

/**
 * Show a perBlockCount marker
 */
PostMicro.prototype.showPerBlockUserCount = function( marginalia, userCount )
{
	var block = userCount.resolveBlock( this.contentElement );
	if ( block )
	{
		var countElement = getChildByTagClass( block, 'span', 'annotation-user-count', _skipContent );
		if ( countElement )
		{
			while ( countElement.firstChild )
				countElement.removeChild( countElement.firstChild );
		}
		else
		{
			countElement = document.createElement( 'span' );
			countElement.setAttribute( 'class', 'annotation-user-count' );
			trace( null, 'block=' + block );
//				block.appendChild( countElement );
			block.insertBefore( countElement, block.firstChild );
		}
		countElement.setAttribute( 'title', userCount.users.join( ' ' ) );
		trace( null, 'title=' + userCount.users.join( ' ' ) );
		var marginalia = window.marginalia;
		var url = userCount.url;
		var blockpath = userCount.blockpath;
		countElement.onclick = function() { marginalia.showBlockAnnotations( url, blockpath ); };
		countElement.appendChild( document.createTextNode( String( userCount.users.length ) ) );
	}
}

/**
 * Check the location value for the window for a fragment identifier starting
 * with a slash (I know this is illegal, but right now it seems the cleanest
 * way to specify a node within a document).
 *
 * BROKEN for pages with more than one hentry.
 */
function getNodeByFragmentPath( url )
{
	var postElements = getChildrenByTagClass( document.documentElement, null, PM_POST_CLASS, null, _skipPostContent );
	if ( 1 != postElements.length )
		return;
	var post = getPostMicro( postElements[ 0 ] );
	var content = post.getContentElement( );

	if ( -1 == url.indexOf( '#' ) )
		return null;
	var path = url.substring( url.indexOf( '#' ) + 1 );
	var node = PathToNode( content, path );
	return node;
}

/**
 * Get the list of notes.  It is a DOM element containing children,
 * each of which has an annotation field referencing an annotation.
 * There is a dummy first child because of spacing problems in IE.
 */
PostMicro.prototype.getNotesElement = function( marginalia )
{
	// Make sure it has the additional annotation properties added
	if ( ! this.notesElement )
	{
		var t = getChildByTagClass( this.element, null, AN_NOTES_CLASS, _skipPostContent );
		this.notesElement = t.getElementsByTagName( 'ol' )[ 0 ];
	}
	return this.notesElement;
}


/* ************************ Add/Show Functions ************************ */
/* These are for adding an annotation to the post and display.
 * addAnnotation calls the other three in order:
 * showNote, highlightRange, positionNote
 * None of these do anything with the server, but they do create interface
 * elements which when activated call server functions.
 *
 * In order to achieve a single point of truth, the only annotation list
 * is the list of annotation notes attached to each post in the DOM.
 * On the one hand, the two can't vary independently.  But I can't think
 * why they would need to.  This way, they can't get out of sync.
 */

/**
 * Get the node that will follow this one once it is inserted in the node list
 * Slow, but necessary when the annotation has not yet been inserted in the node list
 * A return value of null indicates the annotation would be at the end of the list
 */
PostMicro.prototype.getAnnotationNextNote = function( marginalia, annotation )
{
	var notesElement = this.getNotesElement( marginalia );
	// Go from last to first, on the assumption that this function will be called repeatedly
	// in order.  Calling in reverse order gives worst-case scenario O(n^2) behavior.
	for ( var prevNode = notesElement.lastChild;  null != prevNode;  prevNode = prevNode.previousSibling )
	{
		// In case it's a dummy list item or other
		if ( ELEMENT_NODE == prevNode.nodeType && prevNode.annotation )
		{
			// Why on earth would this happen??
			if ( prevNode.annotation.getId() == annotation.getId() )
				break;
			else if ( annotation.compareRange( prevNode.annotation ) >= 0 )
				break;
		}
	}
	
	if ( prevNode )
		return prevNode.nextSibling;
	else
	{
		// Insert at the beginning of the list - but after any initial dummy nodes!
		var nextNode;
		for ( nextNode = notesElement.firstChild;  nextNode;  nextNode = nextNode.nextSibling )
		{
			if ( ELEMENT_NODE == nextNode.nodeType && nextNode.annotation )
				break;
		}
		return nextNode;	// will be null if no annotations in the list
	}
}

/**
 * Add an annotation to the local annotation list and display.
 */
PostMicro.prototype.addAnnotation = function( marginalia, annotation, nextNode )
{
	if ( ! nextNode )
		nextNode = this.getAnnotationNextNote( marginalia, annotation );
	// If the annotation is already displayed, remove the existing display
	var existing = document.getElementById( AN_ID_PREFIX + annotation.getId( ) );
	if ( existing )
		this.removeAnnotation( marginalia, existing.annotation );
	var quoteFound = this.showHighlight( marginalia, annotation );
	// Go ahead and show the note even if the quote wasn't found
	var r = this.showNote( marginalia, annotation, nextNode );
	// Reposition any following notes that need it
	this.repositionSubsequentNotes( marginalia, nextNode );
}

/**
 * Create an item in the notes list
 * pos - the position in the list
 * annotation - the annotation
 */
PostMicro.prototype.showNote = function( marginalia, annotation, nextNode )
{
	var noteList = this.getNotesElement( marginalia );

	// Will need to align the note with the highlight.
	// If the highlight is not found, then the quote doesn't match - display
	// the annotation, but with an error and deactivate some behaviors.
	var highlightElement = getChildByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null );
	var quoteFound = highlightElement != null;
	
	// Create the list item
	var postMicro = this;
	var noteElement = document.createElement( 'li' );
	noteElement.id = AN_ID_PREFIX + annotation.getId();
	noteElement.annotationId = annotation.getId();
	noteElement.annotation = annotation;
	if ( ! quoteFound )
		addClass( noteElement, AN_QUOTENOTFOUND_CLASS );
	
	// Create its contents
	if ( AN_EDIT_NOTE_KEYWORDS == annotation.editing || AN_EDIT_NOTE_FREEFORM == annotation.editing )
	{
		addClass( noteElement, AN_EDITINGNOTE_CLASS );

		if ( ANNOTATION_KEYWORDS )
		{
			var expandButton = document.createElement( 'button' );
			expandButton.className = AN_EXPANDBUTTON_CLASS;
			expandButton.setAttribute( 'title', 'annotation expand edit button' );
			expandButton.appendChild( document.createTextNode(
				AN_EDIT_NOTE_KEYWORDS == annotation.editing ? AN_COLLAPSED_ICON : AN_EXPANDED_ICON ) );
			expandButton.onclick = _expandEdit;
			noteElement.appendChild( expandButton );

			this.showNoteEdit( marginalia, noteElement );
		}
		
		// If anywhere outside the note area is clicked, the annotation will be saved.
		// Beware serious flaws in IE's model (see addAnonBubbleEventListener code for details),
		// so this only works because I can figure out which element was clicked by looking for
		// AN_EDITINGNOTE_CLASS.
		addAnonBubbleEventListener( document.documentElement, 'click', _saveAnnotation );
		addAnonBubbleEventListener( noteElement, 'click', stopPropagation );
	}
	else if ( AN_EDIT_LINK == annotation.editing )
	{
		addClass( noteElement, AN_EDITINGLINK_CLASS );
		
		var controlId = AN_ID_PREFIX + annotation.getId() + '-linkedit';
		
		// add the link label
		var labelNode = document.createElement( 'label' );
		labelNode.setAttribute( 'title', getLocalized( 'annotation link label' ) );
		labelNode.appendChild( document.createTextNode( AN_LINKEDIT_LABEL ) );
		labelNode.setAttribute( 'for', controlId );
		noteElement.appendChild( labelNode );

		// Add the URL input field
		var editNode = document.createElement( 'input' );
		editNode.setAttribute( 'id', controlId );
		editNode.setAttribute( 'value', annotation.getLink() ? annotation.getLink() : '' );
		if ( ANNOTATION_EXTERNAL_LINKING )
		{
			editNode.setAttribute( 'type', 'text' );
			editNode.onkeypress = _editLinkKeypress;
			editNode.onkeyup = _editChangedKeyup;
		}
		else
			editNode.setAttribute( 'type', 'hidden' );
		noteElement.appendChild( editNode );
		
		// add the delete button
		var buttonNode = document.createElement( "button" );
		buttonNode.setAttribute( 'type', "button" );
		buttonNode.className = AN_DELETEBUTTON_CLASS;
		buttonNode.setAttribute( 'title', getLocalized( 'delete annotation link button' ) );
		buttonNode.appendChild( document.createTextNode( "x" ) );
		buttonNode.annotationId = annotation.getId();
		buttonNode.onclick = _deleteLink;
		noteElement.appendChild( buttonNode );

		// If anywhere outside the note area is clicked, the annotation will be saved.
		// Beware serious flaws in IE's model (see addAnonBubbleEventListener code for details),
		// so this only works because I can figure out which element was clicked by looking for
		// AN_EDITINGNOTE_CLASS.
		addAnonBubbleEventListener( document.documentElement, 'click', _saveAnnotationLink );
		addAnonBubbleEventListener( noteElement, 'click', stopPropagation );
	}
	else
	{
		// Does this user have permission to edit this annotation?
		var canEdit = null != marginalia.username && annotation.getUserId() == marginalia.username;
		if ( canEdit )
		{
			var controls = document.createElement( 'div' );
			controls.className = 'controls';
			noteElement.appendChild( controls );
			
			if ( ANNOTATION_LINKING )
			{
				// add the link button
				var buttonNode = document.createElement( 'button' );
				buttonNode.setAttribute( 'type', 'button' );
				buttonNode.className = AN_LINKBUTTON_CLASS;
				buttonNode.setAttribute( 'title', getLocalized( 'annotation link button' ) );
				buttonNode.appendChild( document.createTextNode( AN_LINK_EDIT_ICON ) );
				buttonNode.setAttribute( 'href', annotation.getLink() );
				buttonNode.onclick = _editLink;
				controls.appendChild( buttonNode );
			}

			if ( ANNOTATION_ACCESS || annotation.getAccess() != ANNOTATION_ACCESS_DEFAULT )
			{
				// add the access button
				// even if the feature is turned off, show this if the access is not
				// what's expected - this is a subtle way of at least letting users
				// know something may be amiss
				buttonNode = document.createElement( "button" );
				buttonNode.setAttribute( 'type', "button" );
				buttonNode.className = AN_ACCESSBUTTON_CLASS;
				buttonNode.setAttribute( 'title', annotation.getAccess() == AN_PUBLIC_ACCESS ?
					getLocalized( 'public annotation' ) : getLocalized( 'private annotation' ) );
				buttonNode.appendChild( document.createTextNode( annotation.getAccess() == AN_PUBLIC_ACCESS ? AN_SUN_SYMBOL : AN_MOON_SYMBOL ) );
				buttonNode.annotation = annotation;
				buttonNode.onclick = _toggleAnnotationAccess;
				controls.appendChild( buttonNode );
			}
			
			// add the delete button
			var buttonNode = document.createElement( "button" );
			buttonNode.setAttribute( 'type', "button" );
			buttonNode.className = AN_DELETEBUTTON_CLASS;
			buttonNode.setAttribute( 'title', getLocalized( 'delete annotation button' ) );
			buttonNode.appendChild( document.createTextNode( "x" ) );
			buttonNode.annotationId = annotation.getId();
			buttonNode.onclick = _deleteAnnotation;
			controls.appendChild( buttonNode );
		}
		
		// add the text content
		var noteText = document.createElement( 'p' );
		var keyword = marginalia.keywordService.getKeyword( annotation.getNote() );
		if ( ! quoteFound )
			noteText.setAttribute( 'title', getLocalized( 'quote not found' ) + ': \n"' + annotation.getQuote() + '"' );
		else if ( keyword )
			noteText.setAttribute( 'title', keyword.description );
		noteText.appendChild( document.createTextNode( annotation.getNote() ) );
		noteElement.appendChild( noteText );
		
		// Mark the action
		if ( ANNOTATION_ACTIONS && annotation.getAction() )
			addClass( noteElement, AN_ACTIONPREFIX_CLASS + annotation.getAction() );
		
		if ( canEdit )
		{
			// Add edit behavior
			noteText.onclick = _editAnnotation;
		}
		
		// Add note hover behaviors
		noteElement.onmouseover = _hoverAnnotation;
		noteElement.onmouseout = _unhoverAnnotation;
	}

	var alignElement = highlightElement ? highlightElement : this.getNoteAlignElement( annotation );
	if ( null != alignElement )
	{
		// The margin must be relative to a preceding list item.
		var prevNode = null;
		if ( nextNode )
			prevNode = getPrevByTagClass( nextNode, 'li' );
		else
		{
			prevNode = getChildrenByTagClass( noteList, 'li' );
			if ( prevNode )
				prevNode = prevNode[ prevNode.length - 1 ];
		}

		// If there is no preceding note, create a dummy
		if ( null == prevNode )
		{
			prevNode = document.createElement( 'li' );
			prevNode.setAttribute( 'class', AN_DUMMY_CLASS );
			prevNode.className = AN_DUMMY_CLASS;
			noteList.insertBefore( prevNode, nextNode );
		}
		
		var pushdown = this.calculateNotePushdown( marginalia, prevNode, alignElement );
		noteElement.style.marginTop = '' + ( pushdown > 0 ? String( pushdown ) : '0' ) + 'px';
	}
	
	// Insert the note in the list
	noteList.insertBefore( noteElement, nextNode );
	
	return noteElement;
}

/**
 * Show the edit controls for a note
 * This may be a free-form textarea or a drop-down list, depending on the state of the note
 */
PostMicro.prototype.showNoteEdit = function( marginalia, noteElement )
{
	// Since we're editing, set the appropriate class on body
	addClass( getBodyElement( document ), AN_EDITINGNOTE_CLASS );
	
	var annotation = getNestedFieldValue( noteElement, AN_ANNOTATION_FIELD );
	var selectNode = getChildByTagClass( noteElement, 'select', AN_KEYWORDSCONTROL_CLASS, null );
	var editNode = getChildByTagClass( noteElement, 'textarea', null, null );

	if ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
	{
		if ( null == selectNode )
		{
			var value = annotation.getNote();
			if ( editNode )
			{
				value = editNode.value;
				editNode.parentNode.removeChild( editNode );
			}

			var selectNode = document.createElement( 'select' );
			selectNode.className = AN_KEYWORDSCONTROL_CLASS;
			var keywords = marginalia.keywordService.keywords;
			selectNode.onkeypress = _editNoteKeypress;
			
			// See if the current value of the note is a keyword
			if ( ! marginalia.keywordService.isKeyword( annotation.getNote() ) && annotation.getNote() )
			{
				// First option is the freeform edit value for the note
				var opt = document.createElement( 'option' );
				opt.appendChild( document.createTextNode(
					annotation.getNote().length > 12 ? annotation.getNote().substring( 0, 12 ) : annotation.getNote() ) );
				opt.setAttribute( 'value', annotation.getNote() );
				selectNode.appendChild( opt );
			}
			
			for ( var i = 0;  i < keywords.length;  ++i )
			{
				var keyword = keywords[ i ];
				opt = document.createElement( 'option' );
				if ( value == keyword.name )
					opt.setAttribute( 'selected', 'selected' );
				opt.appendChild( document.createTextNode( keyword.name ) );
				opt.setAttribute( 'value', keyword.name );
				opt.setAttribute( 'title', keyword.description );
				selectNode.appendChild( opt );
			}
			noteElement.appendChild( selectNode );
		}
		return selectNode;
	}
	else if ( AN_EDIT_NOTE_FREEFORM == annotation.editing )
	{
		var value = annotation.getNote();
		if ( selectNode )
		{
			if ( -1 != selectNode.selectedIndex )
				value = selectNode.options[ selectNode.selectedIndex ].value;
			selectNode.parentNode.removeChild( selectNode );
		}
		if ( null == editNode )
		{
			// Create the edit box
			var editNode = document.createElement( "textarea" );
			editNode.rows = 3;
			editNode.appendChild( document.createTextNode( value ) );
			noteElement.appendChild( editNode );

			// Set focus after making visible later (IE requirement; it would be OK to do it here for Gecko)
			//editNode.onkeyup = function( event ) { event = getEvent( event ); return postMicro.editKeyUp( event, this ); };
			editNode.annotationId = annotation.getId();
			editNode.onkeypress = _editNoteKeypress;
			editNode.onkeyup = _editChangedKeyup;
		}
		return editNode;
	}
}

 
/**
 * Display a single highlighted range
 * Inserts em tags of class annotation were appropriate
 */
PostMicro.prototype.showHighlight = function( marginalia, annotation )
{
	var startTime = new Date( );
	
	// TODO: How to handle zero-length ranges?  (Currently Marginalia hangs.)
	// I think the answer is to fix all these conversion functions etc. so that they
	// work consistently and correctly when dealing with zero-length ranges.
	// A zero-length range should be represented by an <em> element in the text with
	// no content;  for insert edit actions this code would then do the right thing.
	
	trace( 'show-highlight', 'Show highlight for annotation at xpath ' + annotation.toString( ) );
		
	// Word range needed for conversion to text range and for later calculations
	var wordRange = new WordRange( );
	if ( annotation.getRange( XPATH_RANGE ) )
	{
		var r = wordRange.fromXPathRange( annotation.getRange( XPATH_RANGE ), this.contentElement, _skipContent );
		if ( false == r )
		{
			trace( 'find-quote', 'Annotation ' + annotation.getId() + ' not within the content area.' );
			return false;
		}
	}
	else
	{
		if ( ! wordRange.fromBlockRange( annotation.getRange( BLOCK_RANGE ), this.contentElement, _skipContent ) )
		{
			trace( 'find-quote', 'Annotation ' + annotation.getId() + ' not within the content area.' );
			return false;
		}
		// TODO: Store XPathRange back to annotation on server
	}
	trace( 'show-highlight', 'WordRange constructed' );
	
	//setTrace( 'WordPointWalker', true );		// Show return values from WordPointWalker
	// TODO: check whether the range even falls within the content element
	var walker = new WordPointWalker( wordRange.start.rel, _skipContent );
	walker.walkToPoint( wordRange.start );
	var initialOffset = walker.currChars;
	var initialRel = walker.currNode;
	
	trace( 'show-highlight', 'Walked to start' );

	var highlightRanges = new Array();
	walker.setPoint( wordRange.end );
	var rangeNum = 0;
	var done = false;
	var actual = '';	// actual quote text
	while ( ! done )
	{
		done = walker.walk( );
		if ( 0 == rangeNum )
		{
			highlightRanges[ rangeNum ] = new TextRange( 
				walker.currNode, initialOffset,
				walker.currNode, walker.currChars );
			var t = walker.currNode.nodeValue;
			actual += t.substring( initialOffset, walker.currChars );
		}
		else
		{
			highlightRanges[ rangeNum ] = new TextRange(
				walker.currNode, 0,
				walker.currNode, walker.currChars );
			var t = walker.currNode.nodeValue;
			actual += t.substring( 0, walker.currChars );
		}
		trace( 'show-highlight', 'HRange: ' + highlightRanges[ rangeNum ].startOffset + ' ' 
			+ highlightRanges[ rangeNum ].endOffset + " [" + walker.currNode + "]\n" ); //+ getNodeText( walker.currNode ) );
		rangeNum += 1;
	}
	walker.destroy();
	trace( 'show-highlight', 'Walked to end' );
	
	// Confirm whether the actual text matches what's expected in the annotation quote
	var quote = annotation.getQuote() ? annotation.getQuote() : '';
	actual = actual.replace( /\s+|\u00a0\s*/g, ' ' );
	quote = quote.replace( /\s+|\u00a0\s*/g, ' ' );
	if ( actual != quote )
	{
		// Older versions (before 2007-06-05) have some context calculation code which could be
		// modified and used here.
		var rangeStr = annotation.getRange( BLOCK_RANGE ) ? annotation.getRange( BLOCK_RANGE ).toString() : '';
		trace( 'find-quote', 'Annotation ' + annotation.getId() + ' range (' + rangeStr + ') \"' + actual + '\" doesn\'t match "' + quote + '"' );
		return false;
	}
	else
		trace( 'find-quote', 'Quote found: ' + actual );
	trace( 'show-highlight', 'Found quote' );
	
//setTrace( 'WordPointWalker', false );		// Show return values from WordPointWalker
	
	// Now iterate over the ranges and highlight each one
	var lastHighlight = null;  // stores the last highlighted area
	for ( var i = 0;  i < highlightRanges.length;  ++i )
	{
		var range = highlightRanges[ i ];
		var node = range.startContainer;
		
		//trace( 'show-highlight', 'Range ' + String(i) + ': ' + range.startContainer.nodeValue.substr(0,40) );

		// Is <em> valid in this position in the document?  (It might well not be if
		// this is a script or style element, or if this is whitespace text in
		// certain other nodes (ul, ol, table, tr, etc.))
		if ( isValidHtmlContent( node.parentNode.tagName, 'em' ) )
		{
			var newNode;
			var text = node.nodeValue + "";
			// break the portion of the node before the annotation off and insert it
			if ( range.startOffset > 0 )
			{
				newNode = document.createTextNode( text.substring( 0, range.startOffset ) );
				node.parentNode.insertBefore( newNode, node );
			}
			// replace node content with annotation
			newNode = document.createElement( 'em' );
			
			newNode.className = AN_HIGHLIGHT_CLASS + ' ' + AN_ID_PREFIX + annotation.getId();
			if ( ANNOTATION_ACTIONS && annotation.getAction() )
				newNode.className += ' ' + AN_ACTIONPREFIX_CLASS + annotation.getAction();
			newNode.onmouseover = _hoverAnnotation;
			newNode.onmouseout = _unhoverAnnotation;
			newNode.annotation = annotation;
			node.parentNode.replaceChild( newNode, node );
			
			if ( ANNOTATION_ACTIONS && 'edit' == annotation.getAction() && annotation.getQuote() )
			{
				var delNode = document.createElement( 'del' );
				delNode.appendChild( node );
				newNode.appendChild( delNode );
			}
			else
				newNode.appendChild( node );
			
			node.nodeValue = text.substring( range.startOffset, range.endOffset );
			lastHighlight = newNode;
			node = newNode;	// necessary for the next bit to work right

			// break the portion of the node after the annotation off and insert it
			if ( range.endOffset < text.length )
			{
				newNode = document.createTextNode( text.substring( range.endOffset ) );
				if ( node.nextSibling )
					node.parentNode.insertBefore( newNode, node.nextSibling );
				else
					node.parentNode.appendChild( newNode );
			}
		}
	}
	
	if ( lastHighlight )
	{
		addClass( lastHighlight, AN_LASTHIGHLIGHT_CLASS );
		// If this was a substitution or insertion action, insert the text
		if ( ANNOTATION_ACTIONS && 'edit' == annotation.getAction() && annotation.getNote() )
			this.showActionInsert( marginalia, annotation );
		// If there's a link from this annotation, add the link icon
		if ( ANNOTATION_LINKING && annotation.getLink() )
			this.showLink( marginalia, annotation );
	}
	var endTime = new Date( );
	trace( 'highlight-timing', 'ShowAnnotation took ' + ( endTime - startTime ) + 'ms for ' + annotation.toString( ) );
	return true;
}

/**
 * Display a link icon for an annotation link
 * Requires that the highlighting for the annotation already be displayed
 * (this is how it figures out just where to put the link icon)
 */
PostMicro.prototype.showLink = function( marginalia, annotation )
{
	// TODO: I don't think this works - should prefix with the AN_LINK_CLASS
	var existingLink = getChildByTagClass( this.contentElement, 'a', AN_ID_PREFIX + annotation.getId(), _skipContent );
	if ( existingLink )
		existingLink.parentNode.removeChild( existingLink );
	
	if ( null != annotation.link && '' != annotation.link )
	{
		var highlights = getChildrenByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null, _skipContent );
		for ( var i = 0;  i < highlights.length;  ++i )
		{
			if ( hasClass( highlights[ i ], AN_LASTHIGHLIGHT_CLASS ) )
			{
				// TODO: should check whether a link is valid in this location;  if not,
				// either refuse to show or insert a clickable Javascript object instead
				var lastHighlight = highlights[ i ];
				var supNode = document.createElement( 'sup' );
				var linkNode = document.createElement( 'a' );
				linkNode.setAttribute( 'href', annotation.getLink() );
				
				if ( null != annotation.getNote() && '' != annotation.getNote() )
				{
					var keyword = marginalia.keywordService.getKeyword( annotation.getNote() );
					if ( keyword )
						linkNode.setAttribute( 'title', keyword.name + ': ' + keyword.description );
					else
					{
						linkNode.setAttribute( 'title',
							annotation.getNote().length > MAX_NOTEHOVER_LENGTH
							? annotation.getNote().substr( 0, MAX_NOTEHOVER_LENGTH ) + '...'
							: annotation.getNote() );
					}
				}
				
				linkNode.appendChild( document.createTextNode( AN_LINK_ICON ) );
				supNode.appendChild( linkNode );
				lastHighlight.appendChild( supNode );
				addClass( linkNode, AN_LINK_CLASS + ' ' + AN_ID_PREFIX + annotation.getId() );
			}
		}
	}
}

/**
 * Display insertion text for insert or substitute actions
 */
PostMicro.prototype.showActionInsert = function( marginalia, annotation )
{
	trace( 'actions', 'showActionInsert for ' + annotation.getQuote() );
	var highlights = getChildrenByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null, _skipContent );
	for ( var i = 0;  i < highlights.length;  ++i )
	{
		if ( hasClass( highlights[ i ], AN_LASTHIGHLIGHT_CLASS ) )
		{
			// TODO: should check whether <ins> is valid in this position
			var lastHighlight = highlights[ i ];
			var insNode = document.createElement( 'ins' );
			insNode.appendChild( document.createTextNode( annotation.getNote() ) );
			lastHighlight.appendChild( insNode );
			trace( 'actions', 'Insert text is ' + annotation.getNote() );
/*			// Insert *after* the annotation highlight
			if ( lastHighlight.nextSibling )
				lastHighlight.parentNode.insertBefore( insNode, lastHighlight.nextSibling );
			else
				lastHighlight.parentNode.appendChild( insNode );
*/			addClass ( insNode, AN_ID_PREFIX + annotation.getId() );
		}
	}
}

/**
 * Position the notes for an annotation next to the highlight
 * It is not necessary to call this method when creating notes, only when the positions of
 * existing notes are changing
 */
PostMicro.prototype.positionNote = function( marginalia, annotation )
{
	var note = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	while ( null != note )
	{
		var alignElement = this.getNoteAlignElement( annotation );
		// Don't push down if no align element was found
		if ( null != alignElement )
		{
			var pushdown = this.calculateNotePushdown( marginalia, note.previousSibling, alignElement );
			note.style.marginTop = ( pushdown > 0 ? String( pushdown ) : '0' ) + 'px';
		}
		note = note.nextSibling;
	}
}

/**
 * Determine where an annotation note should be aligned vertically
 */
PostMicro.prototype.getNoteAlignElement = function( annotation )
{
	// Try to find the matching highlight element
	var alignElement = getChildByTagClass( this.contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null );
	// If there is no matching highlight element, pick the paragraph.  Prefer XPath range representation.
	if ( null == alignElement && annotation.getRange( XPATH_RANGE ) )
		alignElement = annotation.getRange( XPATH_RANGE ).start.getReferenceElement( this.contentElement );
	if ( null == alignElement && annotation.getRange( BLOCK_RANGE ) )
		alignElement = annotation.getRange( BLOCK_RANGE ).start.getReferenceElement( this.contentElement );
	return alignElement;
}

/**
 * Calculate the pixel offset from the previous displayed note to this one
 * by setting the top margin to the appropriate number of pixels.
 * The previous note and the highlight must already be displayed, but this note
 * does not yet need to be part of the DOM.
 */
PostMicro.prototype.calculateNotePushdown = function( marginalia, previousNoteElement, alignElement )
{
	var noteY = getElementYOffset( previousNoteElement, null ) + previousNoteElement.offsetHeight;
	var alignY = getElementYOffset( alignElement, null );
	return alignY - noteY;
}

/**
 * Reposition notes, starting with the note list element passed in
 * Repositioning consists of two things:
 * 1. Updating the margin between notes
 * 2. Collapsing a note if the two notes following it are both pushed down
 */
PostMicro.prototype.repositionNotes = function( marginalia, element )
{
	// We don't want the browser to scroll, which it might under some circumstances
	// (I believe it's a timing thing)
	while ( element )
	{
		var annotation = element.annotation;
		if ( annotation )
		{
			var alignElement = this.getNoteAlignElement( annotation );
			if ( alignElement )
			{
				var goback = false;
				var previous = element.previousSibling;
				var pushdown = this.calculateNotePushdown( marginalia, previous, alignElement );

			/* uncomment this to automatically collapse some notes: *
				// If there's negative pushdown, check whether the preceding note also has pushdown
				if ( pushdown < 0
					&& previous 
					&& previous.annotation 
					&& ! hasClass( previous, AN_NOTECOLLAPSED_CLASS )
					&& previous.pushdown
					&& previous.pushdown < 0 )
				{
					// So now two in a row have negative pushdown.
					// Go back two elements and collapse, then restart pushdown 
					// calculations at the previous element.
					var collapseElement = previous.previousSibling;
					if ( collapseElement && collapseElement.annotation )
					{
						addClass( collapseElement, AN_NOTECOLLAPSED_CLASS );
						element = previous;
						goback = true;
					}
				}
			*/
				// If we didn't have to go back and collapse a previous element,
				// set this note's pushdown correctly.
				if ( ! goback )
				{
					element.style.marginTop = ( pushdown > 0 ? String( pushdown ) : '0' ) + 'px';
					removeClass( element, AN_NOTECOLLAPSED_CLASS );
					element.pushdown = pushdown;
				}
			}
		}
		element = element.nextSibling;
	}
}


/**
 * Reposition a note and any following notes that need it
 * Stop when a note is found that doesn't need to be pushed down
 */
PostMicro.prototype.repositionSubsequentNotes = function( marginalia, firstNote )
{
	for ( note = firstNote;  note;  note = note.nextSibling )
	{
		if ( ELEMENT_NODE == note.nodeType && note.annotation )
		{
			var alignElement = this.getNoteAlignElement( note.annotation );
			if ( alignElement )
			{
				var pushdown = this.calculateNotePushdown( marginalia, note.previousSibling, alignElement );
				if ( note.pushdown && note.pushdown == pushdown )
					break;
				note.style.marginTop = ( pushdown > 0 ? String( pushdown ) : '0' ) + 'px';
				note.pushdown = pushdown;
			}
		}
	}
}

/**
 * Get all annotations on a post by looking at HTML (no check with server)
 */
PostMicro.prototype.listAnnotations = function( marginalia )
{
	var notesElement = this.getNotesElement( marginalia );
	var child = notesElement.firstChild;
	var annotations = new Array( );
	while ( null != child )
	{
		if ( child.annotation )
			annotations[ annotations.length ] = child.annotation;
		child = child.nextSibling;
	}
	return annotations;
}

/* ************************ Remove/Hide Functions ************************ */
/* These are counterparts to the add/show functions above */

/*
 * Remove all annotations from a post
 * Returns an array of removed annotations so the caller can destruct them if necessary
 */
PostMicro.prototype.removeAnnotations = function( marginalia )
{
	var notesElement = this.getNotesElement( marginalia );
	var child = notesElement.firstChild;
	var annotations = new Array( );
	while ( null != child )
	{
		if ( child.annotation )
		{
			annotations[ annotations.length ] = child.annotation;
			child.annotation = null;
		}
		notesElement.removeChild( child );
		child = notesElement.firstChild;
	}
	var micro = this;
	var stripTest = function( tnode )
		{ return micro.highlightStripTest( tnode, null ); };
	stripMarkup( this.contentElement, stripTest, true );
	//portableNormalize( this.contentElement );
	removeClass( this.element, AN_ANNOTATED_CLASS );
	return annotations;
}

/**
 * Test function for removing highlights, edits, and annotation links
 */
PostMicro.prototype.highlightStripTest = function( tnode, emclass )
{
	if ( matchTagClass( tnode, 'em', AN_HIGHLIGHT_CLASS ) && ( ! emclass || hasClass( tnode, emclass ) ) )
		return STRIP_TAG;
	else if ( tnode.parentNode && matchTagClass( tnode.parentNode, 'em', AN_HIGHLIGHT_CLASS ) && ( ! emclass || hasClass( tnode, emclass ) ) )
	{
		if ( matchTagClass( tnode, 'ins', null ) || matchTagClass( tnode, 'del', null ) )
			return STRIP_CONTENT;
		else if ( matchTagClass( tnode, 'a', null ) )
			return STRIP_CONTENT;
	}
	return STRIP_NONE;
}

/**
 * Remove an individual annotation from a post
 */
PostMicro.prototype.removeAnnotation = function( marginalia, annotation )
{
	var next = this.removeNote( marginalia, annotation );
	this.removeHighlight( marginalia, annotation );
	return null == next ? null : next.annotation;
}

/**
 * Remove an note from the displayed list
 * Returns the next list item in the list
 */
PostMicro.prototype.removeNote = function( marginalia, annotation )
{
	var listItem = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	var next = getNextByTagClass( listItem, 'li' );
	listItem.parentNode.removeChild( listItem );
	listItem.annotation = null; // dummy item won't have this field
	clearEventHandlers( listItem, true );	
	return next;
}

/**
 * Recursively remove highlight markup
 */
PostMicro.prototype.removeHighlight = function ( marginalia, annotation )
{
	var contentElement = this.contentElement;
	var highlights = getChildrenByTagClass( contentElement, 'em', AN_ID_PREFIX + annotation.getId(), null, null );
	for ( var i = 0;  i < highlights.length;  ++i )
		highlights[ i ].annotation = null;
	// TODO: Properly handle removal of <del> and <ins> tags for annotations with actions
	var micro = this;
	var stripTest = function( tnode )
		{ return micro.highlightStripTest( tnode, AN_ID_PREFIX + annotation.getId() ); };
	stripMarkup( contentElement, stripTest, true );
	// This normalization was (erroneously) commented out - I think because it's so slow.
	// The best solution would be to a) modify stripMarkup to join adjacent text elements
	// as it goes, or b) write a walker to join relevant text elements.
	// Frankly, it seems fast enough to me.  Perhaps I removed it while making necessary
	// removals elsewhere, or perhaps my short document isn't a sufficient speed test.
	portableNormalize( contentElement );
}

/**
 * Remove annotation links form a highlighted region
 * This assumes the passed node is a highlight region, and that any elements
 * within it are links and should be removed.
 */ 
function stripLinks( node )
{
	var child = node.firstChild;
	while ( null != child )
	{
		var nextChild = child.nextSibling;
		if ( ELEMENT_NODE == child.nodeType )
			node.removeChild( child );
		child = nextChild;
	}
}

/* ************************ Display Actions ************************ */
/* These are called by event handlers.  Unlike the handlers, they are
 * not specific to controls or events (they should make no assumptions
 * about the event that triggered them). */

/**
 * Indicate an annotation is under the mouse cursor by lighting up the note and the highlight
 * If flag is false, this will remove the lit-up indication instead.
 * Works even if the highlight region is missing.
 */
PostMicro.prototype.hoverAnnotation = function( marginalia, annotation, flag )
{
	// Activate the note
	var noteNode = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	if ( flag )
		addClass( noteNode, AN_HOVER_CLASS );
	else
		removeClass( noteNode, AN_HOVER_CLASS );

	// Activate the highlighted areas
	var highlights = getChildrenByTagClass( this.contentElement, null, AN_HIGHLIGHT_CLASS, null, null );
	for ( var i = 0;  i < highlights.length;  ++i )
	{
		var node = highlights[ i ];
		// Need to change to upper case in case this is HTML rather than XHTML
		if ( node.tagName.toUpperCase( ) == 'EM' && node.annotation == annotation )
		{
			if ( flag )
				addClass( node, AN_HOVER_CLASS );
			else
				removeClass( node, AN_HOVER_CLASS );
		}
	}
}

/**
 * Called to start editing a new annotation
 * the annotation isn't saved to the db until edit completes
 */
PostMicro.prototype.createAnnotation = function( marginalia, annotation )
{
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );

	annotation.isLocal = true;
	annotation.editing = annotation.defaultNoteEditMode( marginalia.preferences );
	
	// Show the annotation and highlight
	this.addAnnotation( marginalia, annotation );
	// Focus on the text edit
	var noteElement = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	var editElement = ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
		? getChildByTagClass( noteElement, 'select', null, null )
		: getChildByTagClass( noteElement, 'textarea', null, null );
	// Sequencing here (with focus last) is important
	this.repositionNotes( marginalia, noteElement.nextSibling );
	editElement.focus( );
	// Just in case - IE can't get it right when editing, so I don't trust it
	// on create either, even if it does work for me.
	if ( 'exploder' == detectBrowser( ) )
		editElement.focus( );
	
	window.scrollTo( scrollX, scrollY );
}


/**
 * Save an annotation after editing
 */
PostMicro.prototype.saveAnnotation = function( marginalia, annotation )
{
	// Remove events
	removeAnonBubbleEventListener( document.documentElement, 'click', _saveAnnotation );
	var noteElement = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	removeAnonBubbleEventListener( noteElement, 'click', stopPropagation );
	
	marginalia.preferences.setPreference( PREF_NOTEEDIT_MODE, annotation.editing );
	
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );
	
	// TODO: listItem is an alias for noteElement
	var listItem = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	
	var noteStr = annotation.note;
	if ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
	{
		var selectNode = getChildByTagClass( listItem, 'select', AN_KEYWORDSCONTROL_CLASS, null );
		if ( selectNode.selectedIndex > -1 )
			noteStr = selectNode.options[ selectNode.selectedIndex ].value;
	}
	else
	{
		var editNode = getChildByTagClass( listItem, 'textarea', null, null );
		
		// Check the length of the note.  If it's too long, do nothing, but restore focus to the note
		// (which is awkward, but we can't save a note that's too long, we can't allow the note
		// to appear saved, and truncating it automatically strikes me as an even worse solution.) 
		if ( editNode.value.length > MAX_NOTE_LENGTH )
		{
			alert( getLocalized( 'note too long' ) );
			editNode.focus( );
			return false;
		}
		noteStr = editNode.value;
	}
	
	// don't allow this to happen more than once
	if ( ! annotation.editing )
		return false;
	this.hoverAnnotation( marginalia, annotation, false );
	delete annotation.editing;
	annotation.setNote( noteStr );

	// Update the link hover (if present)
	this.showLink( marginalia, annotation );
	
	// Replace the editable note display
	var nextNode = this.removeNote( marginalia, annotation );
	noteElement = this.showNote( marginalia, annotation, nextNode );
	this.repositionNotes( marginalia, noteElement.nextSibling );
	
	removeClass( getBodyElement( document ), AN_EDITINGNOTE_CLASS );
	
	// TODO: For annotations with links; insert, or substitute actions, must update highlight also
	
	// The annotation is local and needs to be created in the DB
	if ( annotation.isLocal )
	{
		var postMicro = this;
		var f = function( url ) {
			// update the annotation with the created ID
			var id = url.substring( url.lastIndexOf( '/' ) + 1 );
			annotation.setId( id );
			annotation.resetChanges( );
			annotation.isLocal = false;
			var noteElement = document.getElementById( AN_ID_PREFIX + '0' );
			noteElement.id = AN_ID_PREFIX + annotation.getId();
			var highlightElements = getChildrenByTagClass( postMicro.contentElement, 'em', AN_ID_PREFIX + '0', null, null );
			for ( var i = 0;  i < highlightElements.length;  ++i )
			{
				removeClass( highlightElements[ i ], AN_ID_PREFIX + '0' );
				addClass( highlightElements[ i ], AN_ID_PREFIX + annotation.getId() );
			}
		};
		annotation.setUrl( this.url );
		
		// IE may have made a relative URL absolute, which could cause problems
		if ( null != marginalia.urlBase
			&& annotation.url.substring( 0, marginalia.urlBase.length ) == marginalia.UrlBase )
		{
			annotation.setUrl( annotation.getUrl().substring( marginalia.urlBase.length ) );
		}

		annotation.setNote( noteStr );
		annotation.setQuoteTitle( this.title );
		annotation.setQuoteAuthor( this.author );
		marginalia.createAnnotation( annotation, f );
	}
	// The annotation already exists and needs to be updated
	else
	{
		annotation.setNote( noteStr );
		marginalia.updateAnnotation( annotation, null );
	}
	
	window.scrollTo( scrollX, scrollY );
	return true;
}

/**
 * Delete an annotation
 */
PostMicro.prototype.deleteAnnotation = function( marginalia, annotation )
{
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );

	// Delete it on the server
	marginalia.deleteAnnotation( annotation.getId(), null );
	
	// Find the annotation
	var next = this.removeAnnotation( marginalia, annotation );
	if ( null != next )
	{
		var nextElement = document.getElementById( AN_ID_PREFIX + next.id );
		this.repositionNotes( marginalia, nextElement );
	}
	annotation.destruct( );
	
	window.scrollTo( scrollX, scrollY );
}


/**
 * Edit an annotation link.  This displays a URL box, and activates the
 * ability to click on block-level elements to link to them.
 */
PostMicro.prototype.editAnnotationLink = function( marginalia, annotation )
{
	annotation.editing = AN_EDIT_LINK;
	var nextNode = this.removeNote( marginalia, annotation );
	var noteElement = this.showNote( marginalia, annotation, nextNode );
	this.repositionNotes( marginalia, noteElement.nextSibling );
	addClass( getBodyElement( document ), AN_EDITINGLINK_CLASS );
	createCookie( AN_LINKING_COOKIE, annotation.id, 1 );
	_enableLinkTargets( );
	if ( window.addEventListener )
		window.addEventListener( 'blur', _disableLinkTargets, false );
}


/**
 * Save an annotation link after editing
 */
PostMicro.prototype.saveAnnotationLink = function( marginalia, annotation )
{
	// Remove events
	removeAnonBubbleEventListener( document.documentElement, 'click', _saveAnnotationLink );
	var noteElement = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	removeAnonBubbleEventListener( noteElement, 'click', stopPropagation );

	// don't allow this to happen more than once
	if ( ! annotation.editing )
		return false;

	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );
	
	// TODO: listItem is an alias of noteElement above
	var listItem = document.getElementById( AN_ID_PREFIX + annotation.getId() );	
	var editNode = getChildByTagClass( listItem, 'input', null, null );
	
	// Check the length of the link.  If it's too long, do nothing, but restore focus to the note
	// (which is awkward, but we can't save a note that's too long, we can't allow the note
	// to appear saved, and truncating it automatically strikes me as an even worse solution.) 
	if ( editNode.value.length > MAX_LINK_LENGTH )
	{
		alert( getLocalized( 'link too long' ) );
		editNode.focus( );
		return false;
	}
	
	this.hoverAnnotation( marginalia, annotation, false );
	delete annotation.editing;
	annotationsetLink( editNode.value );
	marginalia.updateAnnotation( annotation, null );

	// Update the link display
	this.showLink( marginalia, annotation );
	
	// Replace the editable note display
	var nextNode = this.removeNote( marginalia, annotation );
	var noteElement = this.showNote( marginalia, annotation, nextNode );
	this.repositionNotes( marginalia, noteElement.nextSibling );
	
	_disableLinkTargets( );
	removeCookie( AN_LINKING_COOKIE );
	removeCookie( AN_LINKURL_COOKIE );
	removeClass( getBodyElement( document ), AN_EDITINGLINK_CLASS );
	window.scrollTo( scrollX, scrollY );
	return true;
}


/**
 * Update the display of an annotation link
 */
PostMicro.prototype.updateLink = function( marginalia, annotation )
{
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );
	
	// Update the link display
	this.showLink( marginalia, annotation );

	// Replace the editable note display
	delete annotation.editing;
	var nextNode = this.removeNote( marginalia, annotation );
	var noteElement = this.showNote( marginalia, annotation, nextNode );
	this.repositionNotes( marginalia, noteElement.nextSibling );
	
	removeClass( getBodyElement( document ), AN_EDITINGLINK_CLASS );
	
	window.scrollTo( scrollX, scrollY );
}


/**
 * Delete a link
 */
PostMicro.prototype.deleteLink = function( marginalia, annotation )
{
	// Ensure the window doesn't scroll by saving and restoring scroll position
	var scrollY = getWindowYScroll( );
	var scrollX = getWindowXScroll( );

	// Delete the link on the server
	annotation.link = '';
	marginalia.updateAnnotation( marginalia, annotation.getId(), null );
	
	this.showLink( marginalia, annotation );
	
	window.scrollTo( scrollX, scrollY );
}



/* ************************ Event Handlers ************************ */
/* Each of these should capture an event, obtain the necessary information
 * to execute it, and dispatch it to something else to do the work */

/**
 * Mouse hovers over an annotation note or highlight
 */
function _hoverAnnotation( event )
{
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	post.hoverAnnotation( window.marginalia, annotation, true );
}

/**
 * Mouse hovers off an annotation note or highlight
 */
function _unhoverAnnotation( event )
{
	// IE doesn't have a source node for the event, so use this
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	post.hoverAnnotation( window.marginalia, annotation, false );
}

/**
 * Click on annotation to edit it
 */
function _editAnnotation( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var marginalia = window.marginalia;
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	if ( ! annotation.isDeleted )
	{
		// Ensure the window doesn't scroll by saving and restoring scroll position
		var scrollY = getWindowYScroll( );
		var scrollX = getWindowXScroll( );
		
		annotation.editing = annotation.defaultNoteEditMode( );
		var nextNode = post.removeNote( marginalia, annotation );
		var noteElement = post.showNote( marginalia, annotation, nextNode );
		post.repositionNotes( marginalia, noteElement.nextSibling );
		
		var editElement = ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
			? getChildByTagClass( noteElement, null, AN_KEYWORDSCONTROL_CLASS, null )
			: getChildByTagClass( noteElement, 'textarea', null, null );
		
		// It is absolutely essential that the element get the focus - otherwise, the
		// textarea will sit around looking odd until the user clicks *in* and then *out*,
		// which behavior would be most unimpressive.
		editElement.focus( );
		// Yeah, ain't IE great.  You gotta focus TWICE for it to work.  I don't
		// want to burden other browsers with its childish antics.
		if ( 'exploder' == detectBrowser( ) )
			editElement.focus( );
		
		window.scrollTo( scrollX, scrollY );
	}
}

/**
 * Hit a key while editing an annotation note
 * Handles Enter to save
 */
function _editNoteKeypress( event )
{
	event = getEvent( event );
	var target = getEventTarget( event );
	var post = getNestedFieldValue( target, AN_POST_FIELD );
	var annotation = getNestedFieldValue( target, AN_ANNOTATION_FIELD );
	if ( event.keyCode == 13 )
	{
		post.saveAnnotation( window.marginalia, annotation );
		return false;
	}
	// should check for 27 ESC to cancel edit
	else
	{
		return true;
	}
}


/**
 * Update a text field to indicate whether its content has changed when a key is pressed
 */
function _editChangedKeyup( event )
{
	event = getEvent( event );
	var target = getEventTarget (event );
	var annotation = getNestedFieldValue( target, AN_ANNOTATION_FIELD );
	if ( target.value != annotation.note )
		addClass( target, AN_EDITCHANGED_CLASS );
	else
		removeClass( target, AN_EDITCHANGED_CLASS );
}		


/**
 * Hit a key while editing an annotation link
 */
function _editLinkKeypress( event )
{
	event = getEvent( event );
	var target = getEventTarget( event );
	var post = getNestedFieldValue( target, AN_POST_FIELD );
	var annotation = getNestedFieldValue( target, AN_ANNOTATION_FIELD );
	if ( event.keyCode == 13 )
	{
		//alert('_editLInkKeypress');
		post.saveAnnotationLink( window.marginalia, annotation );
		return false;
	}
	// should check for 27 ESC to cancel edit
	else
	{
		return true;
	}
}

/**
 * Annotation edit loses focus
 */
function _saveAnnotation( event )
{
	// Note that the MS event model doesn't provide info about which element triggered this event
	// so avoid using the event field - look up the currently-edited node instead
	var note = getChildByTagClass( document.documentElement, 'li', AN_EDITINGNOTE_CLASS, null );
	// var post = getParentByTagClass( note, null, 'post', false, null );
	var post = getNestedFieldValue( note, AN_POST_FIELD );
	var annotation = getNestedFieldValue( note, AN_ANNOTATION_FIELD );
	post.saveAnnotation( window.marginalia, annotation );
}

/**
 * Annotation link edit loses focus
 */
function _saveAnnotationLink( event )
{
	// Note that the MS event model doesn't provide info about which element triggered this event
	// so avoid using the event field - look up the currently-edited node instead
	var note = getChildByTagClass( document.documentElement, 'li', AN_EDITINGLINK_CLASS, null );
	// var post = getParentByTagClass( note, null, 'post', false, null );
	var post = getNestedFieldValue( note, AN_POST_FIELD );
	var annotation = getNestedFieldValue( note, AN_ANNOTATION_FIELD );
	post.saveAnnotationLink( window.marginalia, annotation );
}

/**
 * Click annotation delete button
 */
function _deleteAnnotation( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	post.deleteAnnotation( window.marginalia, annotation );
}

/**
 * Click button to create an annotation link
 * This sets a cookie indicating a link is being created.  When browser windows
 * are activated, they check for this cookie to allow the user to click on
 * a block element to create a link to it.
 */
function _editLink( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	post.editAnnotationLink( window.marginalia, annotation );
}


/**
 * Check whether a link-in-progress is consumated
 */
function _updateLinks( )
{
	if ( hasClass( getBodyElement( document ), AN_EDITINGLINK_CLASS ) )
	{
		var annotationId = readCookie( AN_LINKING_COOKIE );
		var newLink = readCookie( AN_LINKURL_COOKIE );
		if ( annotationId && newLink )
		{
			var annotationNode = document.getElementById( AN_ID_PREFIX + annotationId );
			if ( annotationNode )
			{
				var post = getNestedFieldValue( annotationNode, AN_POST_FIELD );
				var annotation = getNestedFieldValue( annotationNode, AN_ANNOTATION_FIELD );
				var editNode = getChildByTagClass( annotationNode, 'input', null, null );
				editNode.value = newLink;
				post.saveAnnotationLink( window.marginalia, annotation );
			}
		}
	}
}


/**
 * Delete a link
 */
function _deleteLink( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	var annotationNode = document.getElementById( AN_ID_PREFIX + annotation.getId() );
	var editNode = getChildByTagClass( annotationNode, 'input', null, null );
	editNode.value = '';
	post.saveAnnotationLink( window.marginalia, annotation );
}

/**
 * Click the expand/collapse edit button
 */
function _expandEdit( event )
{
	event = getEvent( event );
	stopPropagation( event );
	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	var post = getNestedFieldValue( this, AN_POST_FIELD );
	var target = getEventTarget( event );
	var noteElement = getParentByTagClass( target, 'li', null, false, null );
	var expandControl = getChildByTagClass( noteElement, 'button', AN_EXPANDBUTTON_CLASS, null );
	while ( expandControl.firstChild )
		expandControl.removeChild( expandControl.firstChild );
	
	if ( AN_EDIT_NOTE_KEYWORDS == annotation.editing )
	{
		expandControl.appendChild( document.createTextNode( AN_EXPANDED_ICON ) );
		annotation.editing = AN_EDIT_NOTE_FREEFORM;
	}
	else
	{
		// Must save the text value as a possible option in the drop-down, otherwise
		// it will be lost.
		var editNode = getChildByTagClass( noteElement, 'textarea', null, null );
		// If the text is too long, just chop it (popping up a dialog is too
		// complex and wrecks the flow)
		if ( editNode.value.length > MAX_NOTE_LENGTH )
			annotation.setNote( editNode.value.substr( 0, MAX_NOTE_LENGTH ) );
		else
			annotation.setNote( editNode.value );
		expandControl.appendChild( document.createTextNode( AN_COLLAPSED_ICON ) );
		annotation.editing = AN_EDIT_NOTE_KEYWORDS;
	}
	
	var editControl = post.showNoteEdit( marginalia, noteElement );
}

/**
 * Click annotation access button
 */
function _toggleAnnotationAccess( event )
{
	event = getEvent( event );
	stopPropagation( event );

	var annotation = getNestedFieldValue( this, AN_ANNOTATION_FIELD );
	var accessButton = getEventTarget( event );

	annotation.setAccess( annotation.getAccess() == 'public' ? 'private' : 'public' );
	window.marginalia.updateAnnotation( annotation, null );
	while ( accessButton.firstChild )
		accessButton.removeChild( accessButton.firstChild );
	accessButton.appendChild( document.createTextNode( annotation.getAccess() == 'public' ? AN_SUN_SYMBOL : AN_MOON_SYMBOL ) );
	accessButton.setAttribute( 'title', annotation.getAccess() == 'public' ?
		getLocalized( 'public annotation' ) : getLocalized( 'private annotation' ) );
}

/**
 * Hit any key in document
 */
function _keyupCreateAnnotation( event )
{
	var marginalia = window.marginalia;
	event = getEvent( event );
	if ( null != marginalia.username && marginalia.username == marginalia.anusername )
	{
		// Enter to create a regular note
		if ( 13 == event.keyCode )
		{
			if ( createAnnotation( null, false ) )
				stopPropagation( event );
		}
		// C to create an edit action
		else if ( ANNOTATION_ACTIONS && 67 == event.keyCode)
		{
			var action = null;
			if ( 67 == event.keyCode || 99 == event.keyCode )
				action = 'edit';
			if ( null != action )
			{
				if ( createAnnotation( null, false, action ) )
					stopPropagation( event );
			}
		}
	}
}

/**
 * When the user creates a zero-length text range, show the position with a marker
 */
function _mouseupShowCaret( event )
{
	// TODO: Embedding the caret in the text is a bad idea.  Better to find the location
	// by briefly inserting something, then hover another node over it.
	var textRange = getPortableSelectionRange();
	if ( null != textRange )
	{
		var node = textRange.startContainer;
		if ( getParentByTagClass( node, null, PM_POST_CLASS ) )
		{
			// Only show the caret if it's a point (i.e. the range has zero length)
			if ( textRange.startContainer == textRange.endContainer
				&& textRange.startOffset == textRange.endOffset )
			{
				// Create the caret
				var caret = document.createElement( 'span' );
				caret.appendChild( document.createTextNode( '>' ) );
				caret.setAttribute( 'id', AN_RANGECARET_ID );
				var textBefore = node.nodeValue.substring( 0, textRange.startOffset );
				var textAfter = node.nodeValue.substring( textRange.startOffset );
				node.nodeValue = textBefore;
				node.parentNode.insertBefore( caret, node.nextSibling );
				var afterNode = document.createTextNode( textAfter );
				node.parentNode.insertBefore( afterNode, caret.nextSibling );
			}
		}
	}
}

/**
 * Hide the position caret when the user clicks somewhere
 */
function _mousedownHideCaret( event )
{
	var caret = document.getElementById( AN_RANGECARET_ID );
	if ( caret )
	{
		var beforeNode = caret.previousSibling;
		var afterNode = caret.nextSibling;
		caret.parentNode.removeChild( caret );
		// Do a quick bit of normalization
		if ( beforeNode && afterNode && TEXT_NODE == beforeNode.nodeType && TEXT_NODE == afterNode.nodeType )
		{
			beforeNode.nodeValue += afterNode.nodeValue;
			afterNode.parentNode.removeChild( afterNode );
		}
	}
}

/**
 * Skip embedded links created by Marginalia
 */
function _skipAnnotationLinks( node )
{
	return ELEMENT_NODE == node.nodeType 
		&& node.parentNode
		&& 'a' == getLocalName( node )
		&& hasClass( node.parentNode, AN_HIGHLIGHT_CLASS );
}

/**
 * Skip embedded action text created by Marginalia
 * Not needed - ins and del nodes are instead highlight em
 */
function _skipAnnotationActions( node )
{
	return false;
	return ELEMENT_NODE == node.nodeType
		&& 'ins' == getLocalName( node )
		&& node.parentNode
		&& hasClass( node.parentNode, AN_HIGHLIGHT_CLASS );
}


/**
 * Create a highlight range based on user selection
 * This is not in the event handler section above because it's up to the calling
 * application to decide what control creates an annotation.  Deletes and edits,
 * on the other hand, are built-in to the note display.
 */
function createAnnotation( postId, warn, action )
{
	// Test for selection support (W3C or IE)
	if ( ( ! window.getSelection || null == window.getSelection().rangeCount )
		&& null == document.selection )
	{
		if ( warn )
			alert( getLocalized( 'browser support of W3C range required for annotation creation' ) );
		return false;
	}
		
	var textRange = getPortableSelectionRange();
	if ( null == textRange )
	{
		if ( warn )
			alert( '1' + getLocalized( 'select text to annotate' ) );
		return false;
	}
	
	// Check for an annotation with id 0.  If one exists, we can't send another request
	// because the code would get confused by the two ID values coming back.  In that
	// case (hopefully very rare), silently fail.  (I figure the user doesn't want to
	// see an alert pop up, and the natural human instinct would be to try again).
	if ( null != document.getElementById( AN_ID_PREFIX + '0' ) )
		return;
	
	if ( null == postId )
	{
		var contentElement = getParentByTagClass( textRange.startContainer, null, PM_CONTENT_CLASS, false, null );
		if ( null == contentElement )
			return false;
		postId = getParentByTagClass( contentElement, null, PM_POST_CLASS, true, _skipPostContent ).id;
	}
	
	var marginalia = window.marginalia;
	var post = document.getElementById( postId ).post;
	var annotation = new Annotation( post.url );
	annotation.setUserId( marginalia.username );
	if ( action )
		annotation.setAction( action );
	
	var wordRange = new WordRange( );
	wordRange.fromTextRange( textRange, post.contentElement, _skipContent );
	var blockRange = wordRange.toBlockRange( post.contentElement );
	var xpathRange = wordRange.toXPathRange( post.contentElement );
	
	annotation.setQuote( getTextRangeContent( textRange, _skipContent ) );
	if ( 0 == annotation.getQuote().length )
	{
		if ( ANNOTATION_ACTIONS && 'edit' == action )
		{
			// zero-length quotes are ok for edit actions
			// Collapse ranges to points
			blockRange.start = blockRange.end;
			xpathRange.start = xpathRange.end;
		}
		else
		{
			annotation.destruct( );
			if ( warn )
				alert( '3' + getLocalized( 'zero length quote' ) );
			trace( null, "zero length quote '" + annotation.getQuote() + "'" );
			return false;
		}
	}
	
	annotation.setRange( BLOCK_RANGE, blockRange );
	annotation.setRange( XPATH_RANGE, xpathRange );

	// TODO: test selection properly
	if ( null == annotation )
	{
		if ( warn )
			alert( '2' + getLocalized( 'invalid selection' ) );
		return false;
	}
	
	// Check to see whether the quote is too long (don't do this based on the raw text 
	// range because the quote strips leading and trailing spaces)
	if ( annotation.getQuote().length > MAX_QUOTE_LENGTH )
	{
		annotation.destruct( );
		if ( warn )
			alert( getLocalized( 'quote too long' ) );
		return false;
	}
	
	post.createAnnotation( marginalia, annotation );
	return true;
}
