sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/format/DateFormat"
],
function (Controller,JSONModel, Fragment, Filter, FilterOperator, MessageBox, MessageToast, DateFormat) {
    "use strict";

    return Controller.extend("com.app.yardmanagement.controller.Dashboard", {
        onInit: function () {
            var oModel = new JSONModel(sap.ui.require.toUrl("com/app/yardmanagement/model/data.json"));
            this.getView().setModel(oModel);
            var oModel = this.getOwnerComponent().getModel();
            this.getView().byId("pageContainer").setModel(oModel);

            this._setParkingLotModel(); 

            const oLocalModel = new JSONModel({
                VDETAILS: {
                    Vehicleno: "",
                    Processtype:"",
                    Drivername: "",
                    Phonenumber: "",
                    Vehicletype: "",
                    Intime: "",
                    Outtime: "",
                    Parkinglot: "",
                },
                Parkingslots: {
                    Status : "Occupied"
                }
            });

            this.getView().setModel(oLocalModel, "localModel");

            


        },
        onItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            this.byId("pageContainer").to(this.getView().createId(oItem.getKey()));
        },

        onSideNavButtonPress: function () {
            var oToolPage = this.byId("toolPage");
            var bSideExpanded = oToolPage.getSideExpanded();

            this._setToggleButtonTooltip(bSideExpanded);

            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        _setToggleButtonTooltip: function (bLarge) {
            var oToggleButton = this.byId('sideNavigationToggleButton');
            if (bLarge) {
                oToggleButton.setTooltip('Large Size Navigation');
            } else {
                oToggleButton.setTooltip('Small Size Navigation');
            }
        },
        onAssignPressbtn: async function () {
            var oView = this.getView();
            // if (oView.byId("idProcessType").getVisible() === true) {
            //     var oSelect = oView.byId("idProcessType");
            //     var oSelectedItem = oSelect.getSelectedItem();
            //     var sSelectedText = oSelectedItem ? oSelectedItem.getText() : null;
            //     console.log("Selected Text: " + sSelectedText);
 
            // }
            // else {
 
            //     var sSelectedText = oView.byId("idAlotProcess").getText();
            // }
            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
            });
 
            var currentDate = new Date(); // Current system date and time
            var formattedDateTime = oDateFormat.format(currentDate);
            const oPayload = this.getView().byId("page2").getModel("localModel").getProperty("/");
            //oPayload.plotNo.Status = 'Occupied';
            const { Drivername, Phonenumber, Vehicleno, Vehicletype , Processtype} = this.getView().byId("page2").getModel("localModel").getProperty("/").VDETAILS;
            const oModel = this.getView().byId("pageContainer").getModel(); // Assuming "ModelV2" is your ODataModel
           const plotNo = this.getView().byId("idparkingLotSelect").getValue();
           const oProcesstype = this.getView().byId("idselectvt").getSelectedKey();
           oPayload.VDETAILS.Processtype = oProcesstype
           oPayload.VDETAILS.Parkinglot = plotNo
            oPayload.VDETAILS.Intime = formattedDateTime;

            if (!/^\d{10}$/.test(oPayload.VDETAILS.Phonenumber)) {
                this.getView().byId("driverPhoneInput").setValueState("Error").setValueStateText("Mobile number must be a '10-digit number'.");
                return;
            } else {
                this.getView().byId("driverPhoneInput").setValueState("None");
            }

            if (!/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/.test(oPayload.VDETAILS.Vehicleno)) {  // Example format: XX00XX0000
                this.getView().byId("idvehiclenoInput12").setValueState("Error").setValueStateText("Vehicle number format Should be like this 'AP21BE5678'.");
                return;
            } else {
                this.getView().byId("idvehiclenoInput12").setValueState("None");
            } 

            var bDriverNumberExists = await this.checkIfExists(oModel, "/VDEATILSSet", "Phonenumber", oPayload.VDETAILS.Phonenumber);
            var plotAssigned = await this.checkIfExists(oModel, "/VDEATILSSet", "Parkinglot", oPayload.VDETAILS.Parkinglot);
        
            if (bDriverNumberExists || plotAssigned) {
                MessageBox.error(" plot Number or Phone number already assigned ");
                return;
            }

            var oVehicleExist = await this.checkVehicleNo(oModel, oPayload.VDETAILS.Vehicleno)
            if (oVehicleExist) {
                MessageToast.show("Vehicle already exsist")
                return
            };
 
            try {
                // Assuming createData method sends a POST request
 
                await this.createData(oModel, oPayload.VDETAILS, "/VDEATILSSet");

                MessageToast.show("Parking lot assigned successfully")

                var sPath = this.byId("idparkingLotSelect").getSelectedItem().getBindingContext().getPath();
                    const updatedParkingLot = {
                        Parkinglot: plotNo,
                        Status: "Occupied", // Assuming false represents empty parking
                        Processtype:oProcesstype
                    };
                    oModel.update(sPath, updatedParkingLot, {
                        success: function () {
                        }.bind(this),
                        error: function (oError) {
                            sap.m.MessageBox.error("Failed to update: " + oError.message);
                        }.bind(this)
                    });
             this.printAssignmentDetails(oPayload.VDETAILS);
 
            } catch (error) {
                console.error("Error:", error);
            }
            this.onclearPress1();
 
            // var sMessage = `Hello, ${Drivername} your vehicle with vehicle number:${Vehicleno}  is allocated to slot number:${plotNo}`
 
            // oView.byId("idAlotProcess").setVisible(false);
 
            // oView.byId("idProcessType").setVisible(true);
            // this.onSms(phone, sMessage);
 
        },
        checkIfExists: async function (oModel, sEntitySet, sProperty, sValue) {
            return new Promise((resolve, reject) => {
                oModel.read(sEntitySet, {
                    filters: [new sap.ui.model.Filter(sProperty, sap.ui.model.FilterOperator.EQ, sValue)],
                    success: (oData) => {
                        resolve(oData.results.length > 0);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },
        checkVehicleNo: async function (oModel, sVehicleNo) {
            debugger
            return new Promise((resolve, reject) => {
                oModel.read("/VDEATILSSet", {
                    filters: [
                        new Filter("Vehicleno", FilterOperator.EQ, sVehicleNo),
                    ],
                    success: function (oData) {
                        resolve(oData.results.length > 0)
                    },
                    error: function () {
                        reject("An error occurred while checking vehicle existence.");
                    }
                });
            });
        },

        onclearPress1: function () {
            var oView = this.getView();
            var sVehicleNo = oView.byId("idvehiclenoInput12").setValue();
            var sDriverName = oView.byId("driverNameInput").setValue();
            var sPhoneNo = oView.byId("driverPhoneInput").setValue();
            var sProcesstype = oView.byId("idselectvt").setValue();
            var sVehicleType = oView.byId("vehicletypeInput").setValue();
            var sParkingLot = oView.byId("idparkingLotSelect").setValue();
        },
        
        vehiclenumber: function (oEvent) {
            debugger
            var that = this
            const oView = this.getView()
            var oLocalModel = this.getView().byId("page2").getModel("localModel");
            var sVehicleNo = oEvent.getParameter("value");
            var oModel = this.getView().byId("pageContainer").getModel();

            oModel.read("/VDEATILSSet", {
                filters: [
                    new Filter("Vehicleno", FilterOperator.EQ, sVehicleNo)
                ],
                success: function (oData) {
                    var aVehicles = oData.results;
                    if (aVehicles.length > 0) {
                        // Assuming there's only one record with unique vehicalNo

                        var oVehicle1 = aVehicles.filter(checkVehicle)
                        function checkVehicle(v) {
                            console.log(v)
                            return v.Vehicleno === sVehicleNo;
                        }
                        console.log(oVehicle1)

                        var oVehicle = oVehicle1[0];
                        // Set other fields based on the found vehicle
                        oLocalModel.setProperty("/VDETAILS/Vehicleno", oVehicle.Vehicleno);
                        oLocalModel.setProperty("/VDETAILS/Drivername", oVehicle.Drivername);
                        oLocalModel.setProperty("/VDETAILS/Phonenumber", oVehicle.Phonenumber);
                        oLocalModel.setProperty("/VDETAILS/Processtype", oVehicle.Processtype);
                        oLocalModel.setProperty("/VDETAILS/Vehicletype", oVehicle.Vehicletype);
                        oLocalModel.setProperty("/VDETAILS/Intime", oVehicle.Intime);
                        oLocalModel.setProperty("/VDETAILS/Parkinglot", oVehicle.Parkinglot);
                        this.oView.byId("idparkingLotSelect").setValue(oVehicle.Parkinglot);
                        this.oView.byId("idselectvt").setValue(oVehicle.Processtype)
                        // oView.byId("idAlotVehicle").setVisible(true);
                        // oView.byId("idAlotProcess").setVisible(true);
                        // oView.byId("idVehicleType").setVisible(false);
                        // oView.byId("idProcessType").setVisible(false);
                        // oView.byId("idAlotVehicle").setText(oVehicle.Vehicletype);
                        // oView.byId("productInput").setValue(oVehicle.Parkinglot);
                        // Set other fields as needed
                    } else {
                        // Handle case where vehicle number was not found
                        sap.m.MessageToast.show("Vehicle number not found.");
                        // Optionally clear other fields
                        oLocalModel.setProperty("/VDETAILS/Vehicleno", "");
                        oLocalModel.setProperty("/VDETAILS/Drivername", "");
                        oLocalModel.setProperty("/VDETAILS/Phonenumber", "");
                        oLocalModel.setProperty("/VDETAILS/Processtype", "");
                        oLocalModel.setProperty("/VDETAILS/Vehicletype", "");
                        oLocalModel.setProperty("/VDETAILS/Intime", "");
                        // Clear other fields as needed
                    }
                }.bind(this),
                error: function (oError) {
                    sap.m.MessageToast.show("Error fetching vehicle details: " + oError.message);
                }

            });
        },

        onUnassignPressbtn: async function () {
            try {
                const oPayload = this.getView().byId("page2").getModel("localModel").getProperty("/");
                const { Drivername, Phonenumber, Vehicleno, Vehicletype , Intime, Processtype} = oPayload.VDETAILS;
                const oModel = this.getView().byId("pageContainer").getModel();
                const plotNo = this.getView().byId("idparkingLotSelect").getValue();
                oPayload.VDETAILS.Parkinglot = plotNo;
                // const oProcesstype = this.getView().byId("idselectvt").getValue();
                // oPayload.VDETAILS.Processtype = oProcesstype

                var oDateFormat = DateFormat.getDateTimeInstance({
                    pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
                });
     
                var currentDate = new Date(); // Current system date and time
                var formattedDateTime = oDateFormat.format(currentDate);

                oPayload.VDETAILS.Outtime = formattedDateTime;

                var oHID = await this.generateUUID();

                const oHistory = {

                    Historyid: oHID,
                    Vehicleno: Vehicleno,
                    Processtype: Processtype,
                    Drivername: Drivername,
                    Phonenumber: Phonenumber,
                    Vehicletype: Vehicletype,
                    Intime: Intime,
                    Outtime: formattedDateTime,
                    Parkinglot: plotNo
                }


                //create history
                await this.createData(oModel, oHistory, "/historySet");
                

                // Unassign the vehicle from the plot
                await this.deleteData(oModel, "/VDEATILSSet", Vehicleno);

                //sap.m.MessageBox.success(`Vehicle ${Vehicleno} unassigned successfully. Parking lot ${plotNo} is empty.`);

                const updatedParkingLot = {
                    Parkinglot: plotNo,
                    Status: "AVAILABLE", // Assuming false represents empty parking
                };
                oModel.update("/ParkingslotsSet('" + plotNo + "')", updatedParkingLot, {

                    success: function () {
                        sap.m.MessageBox.success(`Vehicle ${Vehicleno} unassigned successfully. Parking lot ${plotNo} is empty.`);
                    },
                    error: function (oError) {
                        sap.m.MessageBox.error("Failed to update parking lot: " + oError.message);
                    }
                });

                // Clear fields or perform any necessary actions
                this.onclearPress1();

            } catch (error) {
                console.error("Error:", error);
                sap.m.MessageBox.error("Failed to unassign vehicle: " + error.message);
            }
        },

        generateUUID: function () {
            debugger
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        onServiceTypeChange: function (oEvent) {
            // Get the selected service type from the dropdown
            var sServiceType = oEvent.getSource().getSelectedKey();
     
            // Get the reference to the slots dropdown (Combobox)
            var oSlotsComboBox = this.getView().byId("idparkingLotSelect");
     
            // Create filters based on selected service type and available status
            var aFilters = [
              new sap.ui.model.Filter("Processtype", sap.ui.model.FilterOperator.EQ, sServiceType),
              new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "AVAILABLE")
            ];
     
            // Apply the filters to the items aggregation of the slots dropdown
            oSlotsComboBox.bindAggregation("items", {
              path: "/ParkingslotsSet",
              template: new sap.ui.core.Item({
                key: "{Parkinglot}",
                text: "{Parkinglot}"
              }),
              filters: aFilters
            });
          },

          onServiceTypeChangeR: function (oEvent) {
            // Get the selected service type from the dropdown
            var sServiceType = oEvent.getSource().getSelectedKey();
     
            // Get the reference to the slots dropdown (Combobox)
            var oSlotsComboBox = this.getView().byId("idparkingLotSelect1");
     
            // Create filters based on selected service type and available status
            var aFilters = [
              new sap.ui.model.Filter("Processtype", sap.ui.model.FilterOperator.EQ, sServiceType),
              new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "AVAILABLE")
            ];
     
            // Apply the filters to the items aggregation of the slots dropdown
            oSlotsComboBox.bindAggregation("items", {
              path: "/ParkingslotsSet",
              template: new sap.ui.core.Item({
                key: "{Parkinglot}",
                text: "{Parkinglot}"
              }),
              filters: aFilters
            });
          },
        //    
        onEdit: function () {
            var oTable = this.byId("idAllocatedSlots");
            var oSelectedItem = oTable.getSelectedItem();

            if (!oSelectedItem) {
                sap.m.MessageToast.show("Please select a slot to edit.");
                return;
            }
            var aCells = oSelectedItem.getCells();
            var oContext = oSelectedItem.getBindingContext();
            var oData = oContext.getObject();
            var sServiceType = oData.Processtype; // Get the service type of the selected item

            // Filter the ComboBox items based on the service type
            var oVBox = aCells[0]; // Assuming the ComboBox is in the first cell (Slot Number column)
            var oComboBox = oVBox.getItems()[1];
            this._filterAvailableSlotsByServiceType(oComboBox, sServiceType);

            // Make the ComboBox visible for editing
            aCells.forEach(function (oCell) {
                var aItems = oCell.getItems ? oCell.getItems() : [];
                aItems.forEach(function (oItem) {
                    if (oItem instanceof sap.m.Text) {
                        oItem.setVisible(false); // Hide text items
                    } else if (oItem instanceof sap.m.Input || oItem instanceof sap.m.ComboBox) {
                        oItem.setVisible(true); // Show input or combo box
                    }
                });
            });

            this.byId("editButton").setVisible(false);
            this.byId("saveButton").setVisible(true);
            this.byId("cancelButton").setVisible(true);
        },
        _filterAvailableSlotsByServiceType: function (oComboBox, sServiceType) {
            var oModel = this.getView().getModel();
            var aFilters = [
                new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "AVAILABLE"),
                new sap.ui.model.Filter("Processtype", sap.ui.model.FilterOperator.EQ, sServiceType)
            ];

            oComboBox.bindAggregation("items", {
                path: "/ParkingslotsSet",
                template: new sap.ui.core.Item({
                    key: "{Parkinglot}",
                    text: "{Parkinglot}"
                }),
                filters: aFilters
            });
        },
        onCancel: function () {
            var oTable = this.byId("idAllocatedSlots");
            var aSelectedItems = oTable.getSelectedItems();

            aSelectedItems.forEach(function (oItem) {
                var aCells = oItem.getCells();
                aCells.forEach(function (oCell) {
                    var aVBoxItems = oCell.getItems();
                    aVBoxItems[0].setVisible(true); // Show Text
                    aVBoxItems[1].setVisible(false); // Hide Input
                });
            });

            this.byId("editButton").setVisible(true);
            this.byId("saveButton").setVisible(false);
            this.byId("cancelButton").setVisible(false);
        },
        onSave: function () {
            const oView = this.getView();
            const oTable = this.byId("idAllocatedSlots");
            const aSelectedItems = oTable.getSelectedItems();
            const oSelected = oTable.getSelectedItem();

            if (oSelected) {
                const oContext = oSelected.getBindingContext().getObject();
                const sVehicle = oContext.Vehicleno;
                const sTypeofDelivery = oContext.Vehicletype;
                const sProcesstype = oContext.Processtype;
                const sDriverMobile = oContext.Phonenumber;
                const sDriverName = oContext.Drivername;
                var sOldSlotNumber = oContext.Parkinglot;

                // Assuming the user selects a new slot number from somewhere
                const oSelect = oSelected.getCells()[0].getItems()[1]; // Assuming the Select is the second item in the first cell
                const sSlotNumber = oSelect.getSelectedKey(); // Get selected slot number

                var oDateFormat = DateFormat.getDateTimeInstance({
                    pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
                });
     
                var currentDate = new Date(); // Current system date and time
                var formattedDateTime = oDateFormat.format(currentDate);

                // oPayload.VDETAILS.Outtime = formattedDateTime;

                // Create a record in history (assuming this is what you want to do)
                const oNewUpdate = {
                    Vehicleno: sVehicle,
                    Intime: formattedDateTime,
                    Vehicletype: sTypeofDelivery,
                    Processtype:sProcesstype,
                    Drivername: sDriverName,
                    Phonenumber: sDriverMobile,
                    Parkinglot: sSlotNumber
                };

                // Update VDetails record
                const oDataModel = this.getOwnerComponent().getModel();
                oDataModel.update("/VDEATILSSet('" + sVehicle + "')", oNewUpdate, {
                    success: function () {
                        // Update old Parkinglot to empty (parkingType: true -> false)
                        const updatedParkingLot = {
                            Parkinglot: sOldSlotNumber,
                            Status: "AVAILABLE", 
                            Processtype: sProcesstype
                        };
                        oDataModel.update("/ParkingslotsSet('" + sOldSlotNumber + "')", updatedParkingLot, {
                            success: function () {
                                // Update new Parkinglot to occupied (parkingType: false -> true)
                                const updatedNewParkingLot = {
                                    Parkinglot: sSlotNumber,
                                    Status: "Occupied", // Assuming false represents empty parking
                                    Processtype: sProcesstype // Assuming false represents occupied parking
                                };
                                oDataModel.update("/ParkingslotsSet('" + sSlotNumber + "')", updatedNewParkingLot, {
                                    success: function () {
                                        // Refresh table binding or do other necessary actions
                                        oTable.getBinding("items").refresh();
                                        sap.m.MessageBox.success("Slot updated successfully");
                                    },
                                    error: function (oError) {
                                        sap.m.MessageBox.error("Failed to update new slot: " + oError.message);
                                    }
                                });
                            },
                            error: function (oError) {
                                sap.m.MessageBox.error("Failed to update old slot: " + oError.message);
                            }
                        });
                    },
                    error: function (oError) {
                        sap.m.MessageBox.error("Failed to update VDetails: " + oError.message);
                    }
                });
            }

            // Additional UI updates or actions after saving
            aSelectedItems.forEach(function (oItem) {
                var aCells = oItem.getCells();
                aCells.forEach(function (oCell) {
                    var aVBoxItems = oCell.getItems();
                    aVBoxItems[0].setVisible(true); // Hide Text
                    aVBoxItems[1].setVisible(false); // Show Input
                });
            });
            this.byId("editButton").setVisible(true);
            this.byId("saveButton").setVisible(false);
            this.byId("cancelButton").setVisible(false);
        },
        // for reservations
        onReservePressbtn: async function () {

            const svendorName = this.getView().byId("InputVedorname").getValue();
            const svendorphno = this.getView().byId("InputVedorphno").getValue();
            const svehicleNo = this.getView().byId("InputVehicleno").getValue();
            const sdriverName = this.getView().byId("InputDriverName").getValue();
            const sphoneNumber = this.getView().byId("InputPhonenumber").getValue();
            const svehicleType = this.getView().byId("InputVehicletype").getValue();
            //const sProcessType = this.getView().byId("idprocessselect").getValue();
            const sReservedDate = this.getView().byId("InputEstimatedtime").getValue();

            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
            });
 
            var currentDate = new Date(); // Current system date and time
            var formattedDateTime = oDateFormat.format(currentDate);
 
            const oReserveModel = new JSONModel({

                Reservations: {

                    Vendorname: svendorName,
                    Vendorphno:svendorphno,
                    Vehicleno: svehicleNo,
                    Drivername: sdriverName,
                    Phonenumber: sphoneNumber,
                    Processtype: "",
                    Vehicletype: svehicleType,
                    Reservedtime: formattedDateTime,
                    Parkinglot: "",
                }
            });
            this.getView().setModel(oReserveModel, "reserveModel");
            const oPayload = this.getView().byId("page7").getModel("reserveModel").getProperty("/");
            const oModel = this.getView().byId("pageContainer").getModel();
            const plotNo = this.getView().byId("idparkingLotSelect1").getValue();
            oPayload.Reservations.Parkinglot = plotNo;

            const oprocesstype = this.getView().byId("idprocessselect").getSelectedKey();
            oPayload.Reservations.Processtype = oprocesstype;
 
            // if (!svehicleNo || !svehicleNo.match(/^[\w\d]{1,10}$/)) {
            //     sap.m.MessageBox.error("Please enter a valid vehicle number (alphanumeric, up to 10 characters).");
            //     return;
            // }
 
            const vehicleExists = await this.checkVehicleExists(oModel, svehicleNo);
            if (vehicleExists) {
                sap.m.MessageBox.error("Vehicle number already Assigned. Please enter a different vehicle number.");
                return;
            }
             
            
             //valid phone number
            if (!/^\d{10}$/.test(sphoneNumber)) {
                this.getView().byId("InputPhonenumber").setValueState("Error").setValueStateText("Mobile number must be a '10-digit number'.");
                return;

            } else {
                this.getView().byId("InputPhonenumber").setValueState("None");
            }


            //validate vehicle number
            if (!/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/.test(svehicleNo)) {  // Example format: XX00XX0000
                this.getView().byId("InputVehicleno").setValueState("Error").setValueStateText("Vehicle number format Should be like this 'AP21BE5678'.");
                return;
            } else {
                this.getView().byId("InputVehicleno").setValueState("None");
            }

            var bDriverNumberExists = await this.checkIfExistsReserve(oModel, "/RESERVATIONSSet", "Phonenumber", sphoneNumber);
            var bVehicleNumberExists = await this.checkIfExistsReserve(oModel, "/RESERVATIONSSet", "Vehicleno", svehicleNo);
        
            if (bDriverNumberExists || bVehicleNumberExists) {
                sap.m.MessageBox.error("vehicle number or phone number already reserved.");
                return;
            }
 
 
            var isReserved = await this.checkParkingLotReservation12(oModel, plotNo);
            if (isReserved) {
                sap.m.MessageBox.error(`Parking lot is already reserved. Please select another parking lot.`, {
                    title: "Reservation Information",
                    actions: sap.m.MessageBox.Action.OK
                });
                return;
            }
 
            try {
                // Assuming createData method sends a POST request
                await this.createData(oModel, oPayload.Reservations, "/RESERVATIONSSet");
                
                const updatedParkingLot = {
                     Parkinglot: plotNo,
                     Status: "RESERVED", // Assuming false represents empty parking
                     Processtype:oprocesstype // Assuming false represents empty parking
                    // Add other properties if needed
                };

                //Update parking lot entity
                oModel.update("/ParkingslotsSet('" + plotNo + "')", updatedParkingLot, {
                    success: function () { 
                        sap.m.MessageToast.show(`${svehicleNo} Reserved to Slot No ${plotNo}`);
                    },
                    error: function (oError) {
                        sap.m.MessageBox.error("Failed to update: " + oError.message);
                    }
                });
 
                // Clear fields or perform any necessary actions

            } catch (error) {
                console.error("Error:", error);
            }

            this.onclearPress12();
 
        },

        onclearPress12: function () {
            var svendorName = this.getView().byId("InputVedorname").setValue();
            var svendorphno = this.getView().byId("InputVedorphno").setValue();
            var svehicleNo = this.getView().byId("InputVehicleno").setValue();
            var sdriverName = this.getView().byId("InputDriverName").setValue();
            var sphoneNumber = this.getView().byId("InputPhonenumber").setValue();
            var svehicleType = this.getView().byId("InputVehicletype").setValue();
            var sprocess = this.getView().byId("idprocessselect").setValue();
            var sReservedDate = this.getView().byId("InputEstimatedtime").setValue();
            var sParkingLot = this.getView().byId("idparkingLotSelect1").setValue();
        },

        checkVehicleExists: async function (oModel, sVehicleNo) {
            return new Promise((resolve, reject) => {
                oModel.read("/VDEATILSSet", {
                    filters: [
                        new Filter("Vehicleno", FilterOperator.EQ, sVehicleNo)
                    ],
                    success: function (oData) {
                        resolve(oData.results.length > 0);
                    },
                    error: function () {
                        reject("An error occurred while checking vehicle number existence.");
                    }
                });
            });
        },
         
        checkPlotAvailability: async function (oModel, plotNo) {
            debugger;
            return new Promise((resolve, reject) => {
                oModel.read("/ParkingslotsSet('" + plotNo + "')",   {
                    success: function (oData) {
                        resolve(oData.parkingType);
                    },
                    error: function (oError) {
                        reject("Error checking plot availability: " + oError.message);
                    }
                });
            });
        },

        checkIfExistsReserve: async function (oModel, sEntitySet, sProperty, sValue) {
            return new Promise((resolve, reject) => {
                oModel.read(sEntitySet, {
                    filters: [new sap.ui.model.Filter(sProperty, sap.ui.model.FilterOperator.EQ, sValue)],
                    success: (oData) => {
                        resolve(oData.results.length > 0);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },
        checkParkingLotReservation12: async function (oModel, plotNo) {
            return new Promise((resolve, reject) => {
                oModel.read("/RESERVATIONSSet", {
                    filters: [
                        new sap.ui.model.Filter("Parkinglot", sap.ui.model.FilterOperator.EQ, plotNo)
                    ],
                    success: function (oData) {
                        resolve(oData.results.length > 0);
                    },
                    error: function () {
                        reject("An error occurred while checking parking lot reservation.");
                    }
                });
            });
        },

        onpressassignrd: async function () {
            debugger
            var oSelected = this.byId("idReserved").getSelectedItems();
            if (oSelected.length === 0) {
                MessageBox.error("Please Select atleast row to Assign");
                return
            };

            var oSelectedRow = this.byId("idReserved").getSelectedItem().getBindingContext().getObject();
            var orow = this.byId("idReserved").getSelectedItem().getBindingContext().getPath();
            var oDateFormat = DateFormat.getDateTimeInstance({
                pattern: "yyyy-MM-dd HH:mm:ss" // Define your desired pattern here
            });
 
            var currentDate = new Date(); // Current system date and time
            var formattedDateTime = oDateFormat.format(currentDate);
            var resmodel = new JSONModel({

                Vehicleno: oSelectedRow.Vehicleno,
                Drivername: oSelectedRow.Drivername,
                Phonenumber: oSelectedRow.Phonenumber,
                Vehicletype: oSelectedRow.Vehicletype,
                Processtype: oSelectedRow.Processtype,
                Intime: formattedDateTime,
                Parkinglot: oSelectedRow.Parkinglot,

            });
            var temp = oSelectedRow.Parkinglot;

            const oModel = this.getView().byId("pageContainer").getModel();
            debugger
            this.getView().byId("page8").setModel(resmodel, "resmodel");
            this.getView().byId("page8").getModel("resmodel").getProperty("/");
            oModel.create("/VDEATILSSet", resmodel.getData(), {
                success: function (odata) {
                    debugger
                    oModel.remove(orow, {
                        success: function () {
                            oModel.refresh()
                            const updatedParkingLot = {
                                Parkinglot:temp,
                                Status: "Occupied", // Assuming false represents empty parking
                                Processtype:oSelectedRow.Processtype // Assuming false represents empty parking
                               // Add other properties if needed
                           };
                            oModel.update("/ParkingslotsSet('" + temp + "')",  updatedParkingLot, {
                                success: function () {
                                    sap.m.MessageBox.success(`Reserved Vehicle ${oSelectedRow.Vehicleno} assigned successfully to plot ${oSelectedRow.Parkinglot}.`);
                                    oModel.refresh();
                                }, error: function () {
                                    sap.m.MessageBox.error("Unable to Update");
                                }

                            })
                        },
                        error: function (oError) {
                            sap.m.MessageBox.error("Failed to update : " + oError.message);
                        }

                    })

                },
                error: function (oError) {
                    sap.m.MessageBox.error("Failed to update : " + oError.message);
                }
            })

        },
        // FOR PIE CHART
        _setParkingLotModel: function () {
            var oModel = this.getOwnerComponent().getModel();
            var that = this;

            oModel.read("/ParkingslotsSet", {
                success: function (oData) {
                    console.log("Fetched Data:", oData);
                    var aItems = oData.results;
                    var availableCount = aItems.filter(item => item.Status === "AVAILABLE").length;
                    var occupiedCount = aItems.filter(item => item.Status === "Occupied").length;
                    var reserveCount = aItems.filter(item => item.Status === "RESERVED").length;


                    var aChartData = {
                        Items: [
                            {
                                Status: "AVAILABLE",
                                Count: availableCount
                            },
                            {
                                Status: "Occupied",
                                Count: occupiedCount
                            },
                            {
                                Status: "RESERVED",
                                Count: reserveCount
                              }
                        ]
                    };
                    var oParkingLotModel = new JSONModel();
                    oParkingLotModel.setData(aChartData);
                    that.getView().setModel(oParkingLotModel, "ParkingLotModel");
                },
                error: function (oError) {
                    console.error(oError);
                }
            });
        },
        // onSearch: function (event) {
        //     debugger
        //     var sQuery = event.getSource().getValue();
        //     var oTable = this.byId("idReserved");
        //     var oBinding = oTable.getBinding("items");
 
        //     if (oBinding) {
        //         var oFilter = new sap.ui.model.Filter([
        //             new Filter("Parkinglot", FilterOperator.Contains, sQuery),
        //             new Filter("Vehicleno", FilterOperator.Contains, sQuery),
        //             new Filter("Drivername", FilterOperator.Contains, sQuery),
        //             new Filter("Phonenumber", FilterOperator.Contains, sQuery),
        //             new Filter("Processtype", FilterOperator.Contains, sQuery),
        //             new Filter("Vehicletype", FilterOperator.Contains, sQuery),

        //         ], false);
        //         oBinding.filter(oFilter);
        //     }
 
        // },
        // onSearch12: function (event) {
        //     debugger
        //     var sQuery = event.getSource().getValue();
        //     var oTable = this.byId("idAllocatedSlots");
        //     var oBinding = oTable.getBinding("items");
 
        //     if (oBinding) {
        //         var oFilter = new sap.ui.model.Filter([
        //             new Filter("Parkinglot", FilterOperator.Contains, sQuery),
        //             new Filter("Vehicleno", FilterOperator.Contains, sQuery),
        //             new Filter("Drivername", FilterOperator.Contains, sQuery),
        //             new Filter("Phonenumber", FilterOperator.Contains, sQuery)

        //         ], false);
        //         oBinding.filter(oFilter);
        //     }
 
        // },

        printAssignmentDetails: function (oPayload) {
            // Generate QR code data
            var qrData = `${oPayload.VDETAILS.Vehicleno}`;

            // Get current date and time
            var currentDate = new Date().toLocaleDateString();
            var currentTime = new Date().toLocaleTimeString();

            // Create a new window for printing
            var printWindow = window.open('', '', 'height=600,width=800');
            printWindow.document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>');

            setTimeout(() => {
                printWindow.document.write('<html><head><title>Print Assigned Details</title>');
                printWindow.document.write('<style>');
                printWindow.document.write('body { font-family: Arial, sans-serif; }');
                printWindow.document.write('.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }');
                printWindow.document.write('.date-time { display: flex; flex-direction: column; }');
                printWindow.document.write('.date-time div { margin-bottom: 5px; }');
                printWindow.document.write('.details-table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
                printWindow.document.write('.details-table th, .details-table td { border: 1px solid #000; padding: 8px; text-align: left; }');
                printWindow.document.write('.details-table th { background-color: #f2f2f2; color: #333; }');
                printWindow.document.write('.details-table td { color: #555; }');
                printWindow.document.write('.field-cell { background-color: #e0f7fa; color: #00796b; }');
                printWindow.document.write('.details-cell { background-color: #fffde7; color: #f57f17; }');
                printWindow.document.write('.qr-container { text-align: right; }');
                printWindow.document.write('</style>');
                printWindow.document.write('</head><body>');
                printWindow.document.write('<div class="print-container">');
                printWindow.document.write('<h1>Parking-slot Details</h1>');
                printWindow.document.write('<div class="header">');
                printWindow.document.write('<div class="date-time">');
                printWindow.document.write('<div><strong>Date:</strong> ' + currentDate + '</div>');
                printWindow.document.write('<div><strong>Time:</strong> ' + currentTime + '</div>');
                printWindow.document.write('</div>');
                printWindow.document.write('<div class="qr-container"><div id="qrcode"></div></div>');
                printWindow.document.write('</div>');


                printWindow.document.write('<table class="details-table">');
                printWindow.document.write('<tr><th>Field</th><th>Details</th></tr>');
                printWindow.document.write('<tr><td class="field-cell">Vehicle Number</td><td class="details-cell">' + oPayload.VDETAILS.Vehicleno + '</td></tr>');
                printWindow.document.write('<tr><td class="field-cell">Driver Name</td><td class="details-cell">' + oPayload.VDETAILS.Drivername + '</td></tr>');
                printWindow.document.write('<tr><td class="field-cell">Phone Number</td><td class="details-cell">' + oPayload.VDETAILS.Phonenumber + '</td></tr>');
                printWindow.document.write('<tr><td class="field-cell">Process Type</td><td class="details-cell">' + oPayload.VDETAILS.Processtype + '</td></tr>');
                printWindow.document.write('<tr><td class="field-cell">Parking Slot Number</td><td class="details-cell">' + oPayload.VDETAILS.Parkinglot+ '</td></tr>');
                printWindow.document.write('</table>');

                // Include QRCode library
                printWindow.document.write('<script>');
                printWindow.document.write('new QRCode(document.getElementById("qrcode"), { text: "' + qrData + '", width: 100, height: 100 });');
                printWindow.document.write('</script>');

                printWindow.document.write('</div>');
                printWindow.document.write('</body></html>');

                printWindow.document.close();
                printWindow.focus();

                printWindow.print();

            }, 2000);
        },

    });
});
