function parseBlockInfoXml( xmldoc )
{
	var listElement = xmldoc.documentElement;
	if ( listElement.tagName != 'blocks' )
		return null;
	
	var blockInfoArray = new Array();
	for ( var blockElement = listElement.firstChild;  blockElement;  blockElement = blockElement.nextSibling )
	{
		if ( ELEMENT_NODE == blockElement.nodeType && 'block' == blockElement.tagName )
		{
			var info = new AnnotatedBlockInfo( );
			info.fromXml( blockElement );
			blockInfoArray[ blockInfoArray.length ] = info;
		}
	}
	return blockInfoArray;
}

function AnnotatedBlockInfo( xpath, blockpath )
{
	this.users = new Array();
	this.xpath = xpath;
	this.blockpath = blockpath;
	this.url = null;
}

AnnotatedBlockInfo.prototype.fromXml = function( blockElement )
{
	this.xpath = blockElement.getAttribute( 'xpath' );
	this.blockpath = blockElement.getAttribute( 'block' );
	this.url = blockElement.getAttribute( 'url' );
	for ( var userElement = blockElement.firstChild;  userElement;  userElement = userElement.nextSibling )
	{
		if ( ELEMENT_NODE == userElement.nodeType && 'user' == userElement.tagName )
			this.users[ this.users.length ] = getNodeText( userElement );
	}
}

AnnotatedBlockInfo.prototype.resolveBlock = function( root )
{
	if ( this.xpath )
	{
		var node = root.ownerDocument.evaluate( this.xpath, root, null, XPathResult.ANY_TYPE, null );
		return node.iterateNext();
	}
}
