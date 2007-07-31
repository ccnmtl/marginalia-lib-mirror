/*
 * marginalia-direct.js
 *
 * Call directly in to Marginalia for debugging purposes.
 * Activate MarginaliaDirect with Shift-Ctrl-S
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
 
function MarginaliaDirect( marginaliaService )
{
	this.marginaliaService = marginaliaService;
	window.marginaliaDirect = this;
	return this;
}

MarginaliaDirect.prototype.init = function( )
{
	if ( document.addEventListener )
	{
		document.addEventListener ('keyup', _marginaliaDirectKeypressHandler, true );
	}
}

function _marginaliaDirectKeypressHandler( event )
{
	var direct = window.marginaliaDirect;
	var character = String.fromCharCode( event.which );
	if ( ( 'm' == character || 'M' == character ) && event.shiftKey && event.ctrlKey )
	{
		var box = document.getElementById( 'marginalia-direct' );
		if ( null != box )
			direct.hide( );
		else
			direct.show( );
	}
}

MarginaliaDirect.prototype.show = function( )
{
	var direct = this;
	
	var box = document.createElement( 'div' );
	box.id = 'marginalia-direct';
	
	var h = document.createElement( 'h1' );
	h.appendChild( document.createTextNode( 'Marginalia Direct Console' ) );
	box.appendChild( h );
	
/*	box.appendChild( this.newLabel( 'md-annotation-id', 'Annotation ID' ) );
	box.appendChild( this.newField( 'md- annotation-id', 6 ) );
	
	box.appendChild( this.newButton( 'md-get-button', 'Get' ) );
*/

	var fieldset = document.createElement( 'fieldset' );
	box.appendChild( fieldset );
	
	var legend = document.createElement( 'legend' );
	legend.appendChild( document.createTextNode( 'Find Annotations' ) );
	fieldset.appendChild( legend );

	fieldset.appendChild( this.newInputField( 'md-annotation-user', null, 'User', window.marginalia.anusername, true ) );
	fieldset.appendChild( this.newInputField( 'md-annotation-url', null, 'URL', window.location, true ) );
	
	fieldset.appendChild( this.newButton( 'md-find', 'Find', function() { direct.listAnnotations( ) } ) );

	var annotationList = document.createElement( 'div' );
	annotationList.id = 'md-annotation-list';
	box.appendChild( annotationList );
	
	box.appendChild( this.newButton( 'md-close', 'Close', function() { direct.hide( ) } ) );
	
	document.body.appendChild( box );
}

MarginaliaDirect.prototype.listAnnotations = function( )
{
	var user = document.getElementById( 'md-annotation-user' );
	var url = document.getElementById( 'md-annotation-url' );
	
	var direct = this;
	
	this.marginaliaService.listAnnotations( url.value, user.value, null, function( xml ) { direct.showAnnotations( xml ); } );
	
	// Clear out any existing list items
	var annotationList = document.getElementById( 'md-annotation-list' );
	while ( annotationList.firstChild )
		annotationList.removeChild( annotationList.firstChild );
}

MarginaliaDirect.prototype.deleteAnnotation = function( annotation )
{
	var direct = this;
	this.marginaliaService.deleteAnnotation( annotation.id, function() { direct.annotationDeleted( annotation.id ); } );
}

MarginaliaDirect.prototype.annotationDeleted = function( id )
{
	var annotationList = document.getElementById( 'md-annotation-list' );
	for ( var item = annotationList.firstChild;  item;  item = item.nextSibling )
	{
		if ( item.annotation && item.annotation.getId() == id )
		{
			item.annotation = null;
			annotationList.removeChild( item );
		}
	}
}

MarginaliaDirect.prototype.updateAnnotation = function( listItem )
{
	var direct = this;
	var annotation = listItem.annotation;
	annotation.setUrl( this.getFieldInput( listItem, 'md-annotation-url' ).value );
	annotation.setRange( SEQUENCE_RANGE, new SequenceRange( this.getFieldInput( listItem, 'md-annotation-sequence-range' ).value ) );
	annotation.setRange( XPATH_RANGE, new XPathRange( this.getFieldInput( listItem, 'md-annotation-xpath-range' ).value ) );
	annotation.setQuote( this.getFieldInput( listItem, 'md-annotation-quote' ).value );
	annotation.setNote( this.getFieldInput( listItem, 'md-annotation-note' ).value );
	annotation.setLink( this.getFieldInput( listItem, 'md-annotation-link' ).value );
	this.marginaliaService.updateAnnotation( annotation, null );
}

MarginaliaDirect.prototype.getFieldInput = function( listItem, fieldName )
{
	var field = domutil.childByTagClass( listItem, null, fieldName );
	field = domutil.childByTagClass( field, 'input', null );
	return field;
}
	

MarginaliaDirect.prototype.showAnnotations = function( xml )
{
	var annotations = parseAnnotationXml( xml );
	for ( var i = 0;  i < annotations.length;  ++i )
		this.showAnnotation( annotations[ i ] );
}

MarginaliaDirect.prototype.showAnnotation = function( annotation )
{
	var direct = this;
	var annotationList = document.getElementById( 'md-annotation-list' );
	var listItem = document.createElement( 'fieldset' );
	listItem.annotation = annotation;
	annotationList.appendChild( listItem );
	
	// ID, User
	var legend = document.createElement( 'legend' );
	legend.appendChild( document.createTextNode( '#' + annotation.getId() + ' by ' + annotation.getUserId() ) );
	listItem.appendChild( legend );
	
	// URL, Range, Access
	var xpathRange = annotation.getRange( XPATH_RANGE );
	var sequenceRange = annotation.getRange( SEQUENCE_RANGE );
	listItem.appendChild( this.newInputField( null, 'md-annotation-url', 'URL', annotation.getUrl(), true ) );
	listItem.appendChild( this.newInputField( null, 'md-annotation-sequence-range', 'Sequence Range', sequenceRange.toString(), true ) );
	listItem.appendChild( this.newInputField( null, 'md-annotation-xpath-range', 'XPath Range', 
		xpathRange ? xpathRange.toString() : '', true ) );
	listItem.appendChild( this.newInputField( null, 'md-annotation-access', 'Access', annotation.getAccess(), true ) );
	
	// Quote, Note, Link
	listItem.appendChild( this.newInputField( null, 'md-annotation-quote', 'Quote', annotation.getQuote(), true ) );
	listItem.appendChild( this.newInputField( null, 'md-annotation-note', 'Note', annotation.getNote(), true ) );
	listItem.appendChild( this.newInputField( null, 'md-annotation-link', 'Link', annotation.getLink(), true ) );
	
	// Last updated
	var p = document.createElement( 'p' );
	p.className = 'updated';
	p.appendChild( document.createTextNode( 'Last updated ' + annotation.updated ) );
	listItem.appendChild( p );
	
	var button = this.newButton( 'md-annotation-update', 'Update', null );
	addEvent( button, 'click', function() { direct.updateAnnotation( listItem ); } );
	listItem.appendChild( button );
	
	button = this.newButton( 'md-annotation-delete', 'Delete', null );
	addEvent( button, 'click', function() { direct.deleteAnnotation( annotation ); } );
	listItem.appendChild( button );
}



MarginaliaDirect.prototype.newInputField = function( id, className, text, value, enabled )
{
	var div = document.createElement( 'div' );
	div.className = 'field ' + className;
	
	div.appendChild( this.newLabel( id, text ) );
	input = this.newInput( id );
	input.id = id
	input.value = value;
	if ( ! enabled )
		input.setAttribute( 'disabled', 'disabled' );
	div.appendChild( input );
	return div;
}

MarginaliaDirect.prototype.newLabel = function( id, labelText )
{
	var label = document.createElement( 'label' );
	label.id = '' + id + '-label';
	label.setAttribute( 'for', id );
	label.appendChild( document.createTextNode( labelText ) );
	return label;
}

MarginaliaDirect.prototype.newInput = function( id, size )
{
	var input = document.createElement( 'input' );
	input.id = id;
	if ( size )
		input.setAttribute( 'size', size );
	return input;
}

MarginaliaDirect.prototype.newButton = function( id, text, f )
{
	button = document.createElement( 'button' );
	button.id = id;
	button.appendChild( document.createTextNode( text ) );
	addEvent( button, 'click', f );
	return button;
}


MarginaliaDirect.prototype.hide = function( )
{
	var box = document.getElementById( 'marginalia-direct' );
	box.parentNode.removeChild( box );
}

