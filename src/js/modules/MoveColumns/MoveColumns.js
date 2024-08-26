import Module from '../../core/Module.js';
import Helpers from '../../core/tools/Helpers.js';

export default class MoveColumns extends Module{

	static moduleName = "moveColumn";
	
	constructor(table){
		super(table);
		
		this.placeholderElement = this.createPlaceholderElement();
		this.hoverElement = false; //floating column header element
		this.hoverOverElement = false; //element most recently hovered over
		this.hoverOverColumn = false; //column most recently hovered over
		this.checkTimeout = false; //click check timeout holder
		this.checkPeriod = 250; //period to wait on mousedown to consider this a move and not a click
		this.moving = false; //currently moving column
		this.toCol = false; //destination column
		this.toColAfter = false; //position of moving column relative to the destination column
		this.startX = 0; //starting position within header element
		this.autoScrollMargin = 40; //auto scroll on edge when within margin
		this.autoScrollStep = 5; //auto scroll distance in pixels
		this.autoScrollTimeout = false; //auto scroll timeout
		
		this.moveHover = this.moveHover.bind(this);
		this.endMove = this.endMove.bind(this);
		
		this.registerTableOption("movableColumns", false); //enable movable columns
	}
	
	createPlaceholderElement(){
		var el = document.createElement("div");
		
		el.classList.add("tabulator-col");
		el.classList.add("tabulator-col-placeholder");
		
		return el;
	}
	
	initialize(){
		if(this.table.options.movableColumns){
			this.subscribe("column-init", this.initializeColumn.bind(this));
			this.subscribe("alert-show", this.abortMove.bind(this));
		}
	}

	abortMove(){
		clearTimeout(this.checkTimeout);
	}
	
	initializeColumn(column){
		var self = this,
		config = {},
		colEl;

		if(!column.modules.frozen && !column.isGroup && !column.isRowHeader){
			colEl = column.getElement();
			
			config.mousemove = function(e){
				if(column.parent === self.moving.parent){
					if((e.pageX - Helpers.elOffset(colEl).left + self.table.columnManager.contentsElement.scrollLeft) > (column.getWidth() / 2)){
						if(self.toCol !== column || !self.toColAfter){
							colEl.parentNode.insertBefore(self.placeholderElement, colEl.nextSibling);
							self.moveColumn(column, true);
						}
					}else{
						if(self.toCol !== column || self.toColAfter){
							colEl.parentNode.insertBefore(self.placeholderElement, colEl);
							self.moveColumn(column, false);
						}
					}
				}
			}.bind(self);
			
			colEl.addEventListener("pointerdown", function(e){
				if(e.which === 1){
					self.checkTimeout = setTimeout(function(){
						self.startMove(e, column);
					}, self.checkPeriod);
				}
			});
			
			colEl.addEventListener("pointerup", function(e){
				if(e.which === 1){
					if(self.checkTimeout){
						clearTimeout(self.checkTimeout);
					}
				}
			});
		}
		
		column.modules.moveColumn = config;
	}
	
	startMove(e, column){
		var element = column.getElement(),
		headerElement = this.table.columnManager.getContentsElement(),
		headersElement = this.table.columnManager.getHeadersElement();

		//Prevent moving columns when range selection is active
		if(this.table.modules.selectRange && this.table.modules.selectRange.columnSelection){
			if(this.table.modules.selectRange.mousedown && this.table.modules.selectRange.selecting === "column"){
				return;
			}
		}

		headerElement.setPointerCapture(e.pointerId);

		this.moving = column;
		this.startX = e.pageX - Helpers.elOffset(element).left;
		
		this.table.element.classList.add("tabulator-block-select");
		
		//create placeholder
		this.placeholderElement.style.width = column.getWidth() + "px";
		this.placeholderElement.style.height = column.getHeight() + "px";
		
		element.parentNode.insertBefore(this.placeholderElement, element);
		element.parentNode.removeChild(element);
		
		//create hover element
		this.hoverElement = element.cloneNode(true);
		this.hoverElement.classList.add("tabulator-moving");
		
		headerElement.appendChild(this.hoverElement);
		
		this.hoverElement.style.left = "0";
		this.hoverElement.style.bottom = (headerElement.clientHeight - headersElement.offsetHeight) + "px";

		headerElement.addEventListener("pointermove", this.moveHover);
		headerElement.addEventListener("pointerup", this.endMove);
		
		this.moveHover(e);

		this.dispatch("column-moving", e, this.moving);
	}

	moveColumn(column, after){
		var movingCells = this.moving.getCells();
		
		this.toCol = column;
		this.toColAfter = after;
		
		if(after){
			column.getCells().forEach(function(cell, i){
				var cellEl = cell.getElement(true);
				
				if(cellEl.parentNode && movingCells[i]){
					cellEl.parentNode.insertBefore(movingCells[i].getElement(), cellEl.nextSibling);
				}
			});
		}else{
			column.getCells().forEach(function(cell, i){
				var cellEl = cell.getElement(true);
				
				if(cellEl.parentNode && movingCells[i]){
					cellEl.parentNode.insertBefore(movingCells[i].getElement(), cellEl);
				}
			});
		}
	}
	
	endMove(e){
		if(e.which === 1){

			this.placeholderElement.parentNode.insertBefore(this.moving.getElement(), this.placeholderElement.nextSibling);
			this.placeholderElement.parentNode.removeChild(this.placeholderElement);
			this.hoverElement.parentNode.removeChild(this.hoverElement);
			
			this.table.element.classList.remove("tabulator-block-select");
			
			if(this.toCol){
				this.table.columnManager.moveColumnActual(this.moving, this.toCol, this.toColAfter);
			}

			this.moving = false;
			this.toCol = false;
			this.toColAfter = false;

			e.target.removeEventListener("pointermove", this.moveHover);
			e.target.removeEventListener("pointerup", this.endMove);
		}
	}
	
	moveHover(e){
		var columnHolder = this.table.columnManager.getContentsElement(),
		scrollLeft = columnHolder.scrollLeft,
		xPos = e.pageX - Helpers.elOffset(columnHolder).left + scrollLeft,
		scrollPos;

		this.hoverElement.style.left = (xPos - this.startX) + "px";
		
		if(xPos - scrollLeft < this.autoScrollMargin){
			if(!this.autoScrollTimeout){
				this.autoScrollTimeout = setTimeout(() => {
					scrollPos = Math.max(0,scrollLeft-5);
					this.table.rowManager.getElement().scrollLeft = scrollPos;
					this.autoScrollTimeout = false;
				}, 1);
			}
		}
		
		if(scrollLeft + columnHolder.clientWidth - xPos < this.autoScrollMargin){
			if(!this.autoScrollTimeout){
				this.autoScrollTimeout = setTimeout(() => {
					scrollPos = Math.min(columnHolder.clientWidth, scrollLeft+5);
					this.table.rowManager.getElement().scrollLeft = scrollPos;
					this.autoScrollTimeout = false;
				}, 1);
			}
		}

		const column = this.getColumnFromPoint(e);
		if (column) {
			column.modules.moveColumn.mousemove(e);
		}
	}

	getColumnFromPoint(e){
		const element = document.elementFromPoint(e.pageX, e.pageY);
		if (element === this.hoverOverElement) {
			return this.hoverOverColumn;
		}
		this.hoverOverElement = element;
		let columnElement = element;
		while (columnElement && !columnElement.classList.contains("tabulator-col")) {
			columnElement = columnElement.parentElement;
		}
		this.hoverOverColumn = columnElement ? this.table.columnManager.columnsByIndex.find(function(column){
			return column.getElement() === columnElement;
		}) || false : false;
		return this.hoverOverColumn;
	}
}
