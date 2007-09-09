/*
 * link-ui-simple.js
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
 
/**
 * This class defines default behavior for elements of the linking user interface
 * An instance is held in th Marginalia object.  Some applications will implement
 * their own versions to provide customized UI behavior.
 */
function SimpleLinkUi( extlinks )
{
	this.extlinks = extlinks;	// permit links to other hosts?
}

SimpleLinkUi.prototype.clear = function( )
{
	this.editNode = null;
}

SimpleLinkUi.prototype.show = function( )
{
	var marginalia = this.marginalia;
	var annotation = this.annotation;
	var post = this.postMicro;
	var noteElement = this.noteElement;
	
	var controlId = AN_ID_PREFIX + annotation.getId() + '-linkedit';
	
	// add the link label
	noteElement.appendChild( domutil.element( 'label', {
		title:  getLocalized( 'annotation link label' ),
		attr_for:  controlId,
		content:  AN_LINKEDIT_LABEL } ) );

	// Add the URL input field
	this.editNode = noteElement.appendChild( domutil.element( 'input', {
		id:  controlId,
		value:  annotation.getLink() ? annotation.getLink() : '',
		type:  'text' } ) );
	if ( this.extlinks )
	{
		addEvent( editNode, 'keypress', SimpleLinkUi._editLinkKeypress );
		addEvent( editNode, 'keyup', _editChangedKeyup );
	}
	
	// add the delete button
	noteElement.appendChild( domutil.button( {
		className:  AN_LINKDELETEBUTTON_CLASS,
		title:  getLocalized( 'delete annotation link button' ),
		content:  'x',
		annotationId:  annotation.getId(),
		onclick: SimpleLinkUi._deleteLink } ) );
}

SimpleLinkUi.prototype.focus = function( )
{
	this.editNode.focus( );
}

SimpleLinkUi.prototype.save = function( )
{
	this.annotation.setLink( this.editNode.value );
	this.annotation.setLinkTitle( '' );
}


/**
 * Hit a key while editing an annotation link
 */
SimpleLinkUi._editLinkKeypress = function( event )
{
	if ( event.keyCode == 13 )
	{
		_saveAnnotation( event );
		return false;
	}
	// should check for 27 ESC to cancel edit
	else
	{
		return true;
	}
}


/**
 * Delete a link
 */
SimpleLinkUi._deleteLink = function( event )
{
	event.stopPropagation( );
	window.marginalia.noteEditor.editNode.value = '';
	_saveAnnotation( event );
}

