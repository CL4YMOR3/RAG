# Tea Garden GRILL-4 Format Macros - User Guide

This guide explains how to use the provided VBA macros (`Module1.bas`, `Module2.bas`, `Module3.bas`, `Module4.bas`) to convert tea garden data (Thowra, Balijan, Zaloni, Deamoolie) into GRILL-4 format in Microsoft Excel. These macros process invoice data and generate formatted Excel files for reporting. Follow the steps exactly to avoid errors. This guide is for non-technical users, but you must have basic Excel knowledge (e.g., opening files, selecting columns).

## Files Included

- `Module1.bas`: For Thowra garden (invoices like `UK 1234`).
- `Module2.bas`: For Balijan garden (invoices like `O.1681 , DO.1951`).
- `Module3.bas`: For Zaloni garden (invoices like `O-1879/2025`).
- `Module4.bas`: For Deamoolie garden (invoices like `UK/44/2025`, `O/49/2025`, `DO/67/2025`).

## Prerequisites

- **Microsoft Excel**: Version 2003 or later (2007+ recommended). Macros may not work in other spreadsheet software (e.g., Google Sheets).
- **Macro-Enabled Environment**: You must enable macros in Excel (instructions below).
- **Input Data**: Your Excel file must have data in the correct format (see "Input Data Requirements" below).
- **Access to Files**: Ensure you have the `.bas` files in a folder you can access (e.g., shared drive, USB, or local folder).

## Step-by-Step Instructions

### Step 1: Enable Macros in Excel

Macros are small programs that run in Excel. For safety, Excel disables them by default. You must enable them to use these macros.

1. Open Excel.
2. Go to **File** &gt; **Options** &gt; **Trust Center** &gt; **Trust Center Settings** &gt; **Macro Settings**.
3. Select **Enable VBA macros (not recommended; potentially dangerous code can run)** or **Enable all macros** (if your IT policy allows).
4. **Optional (Safer)**: Add the folder containing the `.bas` files to **Trusted Locations**:
   - In Trust Center, click **Trusted Locations** &gt; **Add new location**.
   - Browse to the folder with the `.bas` files, select it, and click **OK**.
   - This prevents macro warnings for files in this folder.
5. Click **OK** to save settings and close all dialogs.

**Warning**: Only enable macros for trusted files. Running macros from untrusted sources can harm your computer (e.g., viruses). These macros are safe if obtained directly from Developer.

### Step 2: Import the Macros into Excel

The macros must be added to your Personal Macro Workbook (`PERSONAL.XLSB`) so they are available for any Excel file.

1. Open Excel and create a blank workbook.
2. Press **Alt + F11** to open the VBA Editor (a new window with code tools).
3. In the **Project Explorer** (left panel), find `PERSONAL.XLSB`. If it’s not there:
   - Go to **Developer** &gt; **Record Macro** (if Developer tab is missing, enable it: **File** &gt; **Options** &gt; **Customize Ribbon** &gt; Check **Developer**).
   - In the Record Macro dialog, set **Store macro in: Personal Macro Workbook** and click **OK**.
   - Perform a dummy action (e.g., type "test" in a cell), then click **Stop Recording** (Developer tab).
   - `PERSONAL.XLSB` should now appear in the VBA Editor.
4. Right-click `PERSONAL.XLSB` &gt; **Insert** &gt; **Module**. Repeat to create four modules (one for each `.bas` file).
5. For each module:
   - Right-click the module (e.g., `Module1`) &gt; **File** &gt; **Import File**.
   - Browse to the folder with the `.bas` files, select one (e.g., `Module1.bas`), and click **Open**.
   - Repeat for `Module2.bas`, `Module3.bas`, and `Module4.bas`.
6. Save `PERSONAL.XLSB`: In the VBA Editor, press **Ctrl + S** or go to **File** &gt; **Save**.
7. Close the VBA Editor (Alt + Q or File &gt; Close and Return to Microsoft Excel).

**Warning**: Do not modify the `.bas` files or the imported code. Changes can cause errors or unexpected results. If you encounter issues, contact Developer (ml@jwtl.in or call 114).

### Step 3: Prepare Your Data

Your Excel file must have data in the correct columns and formats for the macros to work. Check the table below for each garden’s requirements.

| **Garden** | **Invoice Format (Column)** | **Other Columns** |
| --- | --- | --- |
| **Thowra** | `UK 1234` (e.g., Column A) | Grade (Col 5), Bag Type (Col 7: `PPWS` or other), From Bag (Col 8), To Bag (Col 9), Manufacture Date (Col 4: `dd.mm.yy TO dd.mm.yy`), Total Net Wt (Col 13). |
| **Balijan** | `DO.1681, O.1956 ` (e.g., Column A) | Grade (Col 3), From Bag (Col 4), To Bag (Col 5), Manufacture Date (Col 9: `dd.mm.yy TO dd.mm.yy`), Total Net Wt (Col 7). |
| **Zaloni** | `O-1879/2025` (e.g., Column A) | Manufacture Date (Col 3: `dd.mm.yy-dd.mm.yy`), Grade (Col 4), Bag Type (Col 6), From Bag (Col 7), To Bag (Col 8), Total Net Wt (Col 12). |
| **Deamoolie** | `UK/44/2025`, `O/49/2025`, `DO/67/2025` (e.g., Column A) | Manufacture Date (Col 3: `dd.mm.yy`), Manufacture Date To (Col 4: `dd.mm.yy`), Grade (Col 5), From Bag (Col 7), To Bag (Col 8), TARE (Col 10: `0.4` or `0.22`), Total Net Wt (Col 12). |

**Warning**: Incorrect data formats (e.g., wrong invoice format, missing columns, or invalid dates) will cause the macro to skip rows or fail. Verify your data before running the macro. Example data:

- Thowra: `UK 1234`, Grade `BPS`, Manufacture Date `20.09.25 TO 21.09.25`.
- Balijan: `DO.1681`, Grade `TGFOP1`, Manufacture Date `20.09.25 TO 21.09.25`.
- Zaloni: `O-1879/2025`, Grade `FOP`, Manufacture Date `06.10.25-07.10.25`.
- Deamoolie: `UK/44/2025`, `O/49/2025`, Grade `BPS` or `TGFOP1`, TARE `0.4` or `0.22`, Manufacture Date `06.10.25`.

### Step 4: Run the Macro

1. Open your Excel file with the data.
2. Press **Alt + F8** to open the Macro dialog.
3. Select the macro for your garden:
   - `ThowraToG4Format` for Thowra.
   - `BalijanToG4Format` for Balijan.
   - `ZaloniToG4Format` for Zaloni.
   - `DeamoolieToG4Format` for Deamoolie.
4. Click **Run**.
5. Select the column with invoice numbers (e.g., Column A). Click **OK**.
6. When prompted, choose a save location and filename for the output file(s):
   - Thowra: `Thowra G4 dd-mm-yyyy.xlsx` (or `.xls`).
   - Balijan: `BALIJAN (H) G4 dd-mm-yyyy.xlsx` (or `.xls`).
   - Zaloni: `ZALONI G4 dd-mm-yyyy.xlsx` (or `.xls`).
   - Deamoolie: `DEAMOOLIE G4 CTC dd-mm-yyyy.xlsx` and/or `DEAMOOLIE G4 Orthodox dd-mm-yyyy.xlsx` (or `.xls`).
7. Click **Save**. If you cancel, the file won’t be saved.

**Output**:

- Thowra, Balijan, Zaloni: One Excel file with a `GRILL4_Format` sheet, sorted by grade (e.g., Thowra: `BPS, BOP, ...`; Balijan/Zaloni: `TGFOP1, TGFOP, ...`).
- Deamoolie: Up to two files (one for CTC if `UK` invoices, one for Orthodox if `O`/`DO` invoices), each with a `GRILL4_Format_CTC` or `GRILL4_Format_Orthodox` sheet, sorted by grade (CTC: `BPS, BOP, ...`; Orthodox: `TGFOP1, TGFOP, ...`).
- Columns: `SAMPLEDATE`, `SAMPLEID`, `UNIT`, `CITY FROM`, `SEASON`, `PREFIX`, `NO`, `GRADE`, `FROM BAG`, `TO BAG`, `BAG TYPE`, `TOTAL NET WT`, `MNF. DATE FROM`, `MNF. DATE TO`, `BLANK`.

**Warning**: Do not run multiple macros on the same data without verifying the output. Running the wrong macro (e.g., Thowra macro on Deamoolie data) will produce incorrect results. Always select the correct macro for your garden.

### Step 5: Verify the Output

- Check the generated file(s) for:
  - Correct sheet names (`GRILL4_Format`, or `GRILL4_Format_CTC`/`GRILL4_Format_Orthodox` for Deamoolie).
  - Sorted grades (e.g., `BPS, BOP, ...` for Thowra; `TGFOP1, TGFOP, ...` for Balijan/Zaloni/Deamoolie Orthodox).
  - Correct `BAG TYPE` (e.g., Deamoolie: `HPS` for TARE `0.4`, `WS` for TARE `0.22`; Balijan: `WS` for specific grades, else `HPS`).
  - Dates in `dd-mm-yyyy` format (e.g., `06-10-2025`).
- If data is missing or incorrect, check your input data and rerun the macro.

**Warning**: Do not modify the output files manually before submission, as this may violate GRILL-4 format requirements. If issues occur, contact Developer with your input data and Excel version.

### Troubleshooting

- **Macro Doesn’t Run**: Ensure macros are enabled (Step 1). Check that `PERSONAL.XLSB` contains all four modules (Step 2).
- **No Data in Output**: Verify invoice formats and column numbers match the requirements (Step 3). Invalid invoices (e.g., missing prefix) are skipped.
- **Error Messages**: Note the error message and contact Developer. Common issues include incorrect data formats or disabled macros.
- **Excel Version Issues**: The macros support Excel 2003 (`.xls`) and 2007+ (`.xlsx`). If using Excel 2003, ensure files save as `.xls`. For other versions, contact Developer.

## Disclaimers and Warnings

1. **User Responsibility**: You are responsible for ensuring your input data is correct and in the specified format. Incorrect data (e.g., wrong invoice format, missing columns) may result in incomplete or incorrect output, for which Developer is not liable.
2. **Macro Safety**: These macros are safe if obtained from Developer. Do not run macros from untrusted sources, as they may contain malicious code that can harm your computer or data.
3. **No Modifications**: Do not edit the `.bas` files, VBA code, or output files unless instructed by Developer. Unauthorized changes may cause errors or invalid outputs, for which Developer is not responsible.
4. **Excel Compatibility**: The macros are tested for Excel 2003 and 2007+. Compatibility with other software (e.g., LibreOffice) or untested Excel versions is not guaranteed. Contact Developer if you use a different version.
5. **Data Backup**: Always back up your input Excel files before running the macros. While the macros do not modify your source file, accidental overwrites or errors during processing may occur, and Developer is not liable for data loss.
6. **Network/Security Policies**: Ensure your organization’s IT policies allow macro execution and file saving to your chosen location. Failure to comply with IT policies may prevent macro operation, and Developer is not responsible for such restrictions.
7. **Support Limitation**: Support is provided by Developer for issues related to these macros only when used as instructed. Issues arising from incorrect usage, unapproved modifications, or external factors (e.g., network issues) are your responsibility.

## Contact

For issues, questions, or updates to the macros, contact Affan Shazer at ml@jwtl.in or dial 114. Provide:

- Your Excel version (e.g., 2003, 2016).
- A screenshot or copy of your input data.
- The exact error message or issue description.

**Do not share sensitive data (e.g., proprietary tea garden data) without proper authorization.**

**Last Updated**: October 23, 2025

---

**Disclaimer**: These macros are provided "as is" without warranty of any kind. The Developer is not liable for any damages, data loss, or issues arising from the use or misuse of these macros. Use at your own risk and follow all instructions carefully.