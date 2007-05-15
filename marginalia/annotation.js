/*
 * annotation.js
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
 
// namespaces
NS_PTR = 'http://www.geof.net/code/annotation/';
NS_ATOM = 'http://www.w3.org/2005/Atom';

// values for annotation.access
AN_PUBLIC_ACCESS = 'public';
AN_PRIVATE_ACCESS = 'private';

// values for annotation.editing (field is deleted when not editing)
AN_EDIT_NOTE_FREEFORM = 'note freeform';
AN_EDIT_NOTE_KEYWORDS = 'note keywords';
AN_EDIT_LINK = 'link';


/* ************************ Annotation Class ************************ */
/*
 * This is a data-only class with (almost) no methods.  This is because all annotation
 * function either affect the display or hit the server, so more properly belong
 * to AnnotationService or PostMicro.
 * An annotation is based on a selection range relative to a contentElement.
 * The ID of a new range is 0, as it doesn't yet exist on the server.
 */
function Annotation( post, range )
{
	if ( null != post )
	{
		this.container = post.contentElement;
		this.quote_author = post.author;
		this.quote_title = post.title;
	}
	this.range = range;
	this.rangeStr = post && range ? range.toString( post.contentElement ) : null;
	this.post = post;
	this.id = 0;
	this.note = '';
	this.access = ANNOTATION_ACCESS_DEFAULT;
	this.quote = '';
	this.isLocal = false;
	// this.editing = null; -- deleted when not needed
	this.link = '';
	return this;
}

function compareAnnotationRanges( a1, a2 )
{
	return a1.range.compare( a2.range );
}

function annotationFromTextRange( post, textRange )
{
	var range = textRangeToWordRange( textRange, post.contentElement, _skipContent );
	if ( null == range )
		return null;  // The range is probably invalid (e.g. whitespace only)
	// TODO: The annotation object should be comfortable storing only the data about an annotation,
	// without links to actual references etc.  Those should be derived or retrievable via methods
	// (e.g. string = annotation.range (string), but WordRange = annotation.getRange())
	var annotation = new Annotation( post, range );
	annotation.rangeStr = range.toString( post.contentElement );
	// Can't just call toString() to grab the quote from the text range, because that would
	// include any smart copy text.
	annotation.quote = getTextRangeContent( textRange, _skipContent );
	//annotation.quote = textRange.toString( );
	return annotation;
}

/**
 * Destructor to prevent IE memory leaks
 */
Annotation.prototype.destruct = function( )
{
	this.container = null;
	this.post = null;
	if ( this.range && this.range.destroy )
		this.range.destroy( );
	this.range = null;
}


/**
 * Figure out whether note editing should be in keywords or freeform mode
 * If the note text is a keyword, default to keywords.  Otherwise, check
 * preferences.
 */
Annotation.prototype.defaultNoteEditMode = function( preferences )
{
	if ( ! ANNOTATION_KEYWORDS )
		return AN_EDIT_NOTE_FREEFORM;
	else if ( '' == this.note )
	{
		var pref = preferences.getPreference( PREF_NOTEEDIT_MODE );
		return pref ? pref : AN_EDIT_NOTE_KEYWORDS;
	}
	else
		return window.keywordService.isKeyword( this.note )
			? AN_EDIT_NOTE_KEYWORDS : AN_EDIT_NOTE_FREEFORM;
}


/**
 * Parse Atom containing annotation info and return an array of annotation objects
 */
function parseAnnotationXml( xmlDoc )
{
	var annotations = new Array( );
	
	if ( xmlDoc.documentElement.tagName == "error" )
	{
		logError( "parseAnnotationXML Error: " + xmlDoc.documentElement.textValue() );
		alert( getLocalized( 'corrupt XML from service' ) );
		return null;
	}
	else
	{
		for ( var i = 0;  i < xmlDoc.documentElement.childNodes.length;  ++i ) {
			child = xmlDoc.documentElement.childNodes[ i ];
			// obliged to use tagName here rather than localName due to IE
			if ( child.namespaceURI == NS_ATOM && getLocalName( child ) == 'entry' )
			{
				var hOffset, hLength, text, url, id;
				var annotation = new Annotation( );
				var rangeStr = null;
				for ( var field = child.firstChild;  field != null;  field = field.nextSibling )
				{
					if ( field.namespaceURI == NS_ATOM && getLocalName( field ) == 'link' )
					{
						var rel = field.getAttribute( 'rel' );
						var href = field.getAttribute( 'href' );
						// What is the role of this link element?  (there are several links in each entry)
						if ( 'self' == rel )
							annotation.id = href.substring( href.lastIndexOf( '/' ) + 1 );
						else if ( 'related' == rel )
							annotation.link = href;
						else if ( 'alternate' == rel )
						{
							if ( null != window.annotationUrlBase
								&& href.substring( 0, window.annotationUrlBase.length ) == window.annotationUrlBase )
							{
								href = href.substring( window.annotationUrlBase.length );
							}
							annotation.url = href;
							annotation.post = findPostByUrl( href );
						}
					}
					else if ( NS_ATOM == field.namespaceURI && 'author' == getLocalName( field ) )
					{
						for ( var nameElement = field.firstChild;  null != nameElement;  nameElement = nameElement.nextSibling )
						{
							if ( NS_ATOM == nameElement.namespaceURI && 'name' == getLocalName( nameElement ) )
								annotation.userid = nameElement.firstChild ? nameElement.firstChild.nodeValue : null;
						}
					}
					else if ( field.namespaceURI == NS_ATOM && getLocalName( field ) == 'title' )
						annotation.note = null == field.firstChild ? '' : field.firstChild.nodeValue;
					else if ( field.namespaceURI == NS_ATOM && getLocalName( field ) == 'summary' )
						annotation.quote = null == field.firstChild ? null : field.firstChild.nodeValue;
					else if ( field.namespaceURI == NS_PTR && getLocalName( field ) == 'range' )
						annotation.rangeStr = field.firstChild.nodeValue;
					else if ( field.namespaceURI == NS_PTR && getLocalName( field ) == 'access' )
					{
						if ( field.firstChild )
							annotation.access = field.firstChild.nodeValue;
						else
							annotation.access = 'private';
					}
					else if ( field.namespaceURI == NS_ATOM && getLocalName( field ) == 'updated' )
						annotation.updated = field.firstChild ? null : field.firstChild.nodeValue;
				}
				// Linking up with posts and ranges should be moved out of here, so that this
				// parse function would make sense to call outside the context of the annotated
				// document (MarginaliaDirect has to do this)
				//
				// This should really check the validity of the whole annotation.  Most important
				// though is that the ID not be zero, otherwise this would interfere with the
				// creation of new annotations.
				if ( 0 != annotation.id && null != annotation.post )
				{
					annotation.range = new WordRange( );
					annotation.range.fromString( annotation.post.contentElement, annotation.rangeStr );
					annotations[ annotations.length ] = annotation;
				}
			}
		}
		annotations.sort( compareAnnotationRanges );
		return annotations;
	}
}
